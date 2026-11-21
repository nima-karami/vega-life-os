import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { type CollectionName, taskStatusSchema } from "@vega/shared";
import { z } from "zod";
import {
  type ChangeSetReceipt,
  commitChangeSet,
  ExpectationFailedError,
  getRecordKey,
} from "../../core/change-set";
import { ToolError } from "../../core/tool-error";
import type { AccessTokenGrant } from "../access-tokens/grant";
import { mcpCollectionSchema, RECORD_ID_PATTERN } from "./mcp-collections";
import type { McpClock, McpContext, ToolRegistrar } from "./mcp-context";
import { type LoadedDataset, loadCollections } from "./ops/dataset-loader";
import { planEditSubgoals } from "./ops/goal-ops";
import { HABIT_COLLECTIONS, planCheckInHabit, planSetHabitState } from "./ops/habit-ops";
import { planWriteJournal } from "./ops/journal-ops";
import type { PlanOutcome } from "./ops/plan-support";
import {
  listRequiredCollections,
  planCreateRecord,
  planDeleteRecord,
  planUpdateRecord,
} from "./ops/record-ops";
import { planSetTaskStatus } from "./ops/task-ops";
import { toToolFailure, toToolSuccess } from "./tool-result";

const MAX_PLAN_ATTEMPTS = 3;
const CALENDAR_COLLECTIONS = new Set(["tasks", "calendarEvents"]);

type Planner = (dataset: LoadedDataset, clock: McpClock) => PlanOutcome;
type WriteRequest = { tool: string; collections: readonly CollectionName[]; plan: Planner };

export function assertWriteScope(grant: AccessTokenGrant): void {
  if (grant.scope !== "write")
    throw new ToolError("FORBIDDEN", "this token is read-only; writes need a read & write token");
}

const touchesCalendarIds = (committedIds: Record<string, string[]>) =>
  Object.entries(committedIds).some(
    ([collection, ids]) => CALENDAR_COLLECTIONS.has(collection) && ids.length > 0,
  );

function readCommittedIds(error: unknown): Record<string, string[]> {
  if (!(error instanceof ToolError)) return {};
  const committedIds = error.detail?.committedIds;
  return typeof committedIds === "object" && committedIds !== null
    ? (committedIds as Record<string, string[]>)
    : {};
}

function readPrimaryRecord(outcome: PlanOutcome, receipt: ChangeSetReceipt) {
  if (!outcome.primary) return {};
  const record = receipt.records[getRecordKey(outcome.primary.collection, outcome.primary.id)];
  return record ? { record } : {};
}

async function planAndCommit(context: McpContext, request: WriteRequest, attempt = 1) {
  const { firestore, grant } = context;
  const clock = context.clock();
  const dataset = await loadCollections(firestore, grant.uid, request.collections, clock.today);
  const outcome = request.plan(dataset, clock);
  try {
    const primaryKey = outcome.primary
      ? getRecordKey(outcome.primary.collection, outcome.primary.id)
      : undefined;
    const receipt = await commitChangeSet(
      firestore,
      grant.uid,
      outcome.changeSet,
      clock.nowIso,
      primaryKey,
    );
    return { outcome, receipt };
  } catch (error) {
    // Only a first-chunk conflict propagates as ExpectationFailedError, so nothing has landed yet.
    if (!(error instanceof ExpectationFailedError)) throw error;
    if (attempt < MAX_PLAN_ATTEMPTS) return planAndCommit(context, request, attempt + 1);
    throw new ToolError("CONFLICT", "record changed concurrently, retry");
  }
}

async function runWrite(context: McpContext, request: WriteRequest): Promise<CallToolResult> {
  const { grant } = context;
  console.info("mcp tool", { uid: grant.uid, tokenId: grant.tokenId, tool: request.tool });
  let committedIds: Record<string, string[]> = {};
  try {
    assertWriteScope(grant);
    const { outcome, receipt } = await planAndCommit(context, request);
    committedIds = receipt.committedIds;
    return toToolSuccess({
      ...outcome.result,
      ...readPrimaryRecord(outcome, receipt),
      writtenCount: receipt.written,
      removedCount: receipt.removed,
      syncVersion: receipt.syncVersion,
    });
  } catch (error) {
    committedIds = readCommittedIds(error);
    return toToolFailure(error);
  } finally {
    if (touchesCalendarIds(committedIds)) context.calendar.scheduleReconcile(grant.uid);
  }
}

const recordIdSchema = z
  .string()
  .regex(RECORD_ID_PATTERN, "ids use letters, digits and _ : @ . - (max 128)");
const isoDateSchema = z.string().describe("YYYY-MM-DD");

function registerRecordTools(server: McpServer, context: McpContext): void {
  server.registerTool(
    "create_record",
    {
      title: "Create a record",
      description:
        "Create a record in a writable collection. VEGA fills the id (with the collection's prefix) unless you pass one; an id that already exists returns CONFLICT, so a retry is safe. Domain collections apply the app's defaults: a new habit needs valueId and gets its next 14 days of tasks, a review for an existing periodKey updates that review, a journal entry is keyed by date. financeBudgets, financeSettlements and cardPrefs need their natural-key id. Unknown fields are dropped and listed under ignoredKeys. Call describe_collection first for the fields.",
      inputSchema: {
        collection: mcpCollectionSchema,
        record: z.record(z.string(), z.unknown()),
        id: recordIdSchema.optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    (input) =>
      runWrite(context, {
        tool: "create_record",
        collections: listRequiredCollections(input.collection),
        plan: (dataset, clock) => planCreateRecord(dataset, input, clock),
      }),
  );
  server.registerTool(
    "update_record",
    {
      title: "Update a record",
      description:
        "Shallow-merge a patch into a stored record and write the whole record through the app's rules. Tasks take one kind of change per call: clearing date (unschedule), a habitId change, status, detached:false (relink a detached habit task), or plain fields (a new date may ride with plain fields). A habit schedule or time change removes its future undone tasks and regenerates them. Unarchiving a value regenerates its habits' tasks. Habit lifecycle fields go through set_habit_state.",
      inputSchema: {
        collection: mcpCollectionSchema,
        id: recordIdSchema,
        patch: z.record(z.string(), z.unknown()),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    (input) =>
      runWrite(context, {
        tool: "update_record",
        collections: listRequiredCollections(input.collection),
        plan: (dataset, clock) => planUpdateRecord(dataset, input, clock),
      }),
  );
  server.registerTool(
    "delete_record",
    {
      title: "Delete a record",
      description:
        "Delete a record. Deleting a value also deletes its goals, habits and linked tasks; deleting a habit deletes its tasks; deleting a goal unlinks its habits and tasks; deleting a finance category deletes its budgets. Such a cascade first returns CONFIRM_REQUIRED with every affected id and a confirmCascade digest: show it to the user, then call again with that digest.",
      inputSchema: {
        collection: mcpCollectionSchema,
        id: recordIdSchema,
        confirmCascade: z.string().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    (input) =>
      runWrite(context, {
        tool: "delete_record",
        collections: listRequiredCollections(input.collection),
        plan: (dataset) => planDeleteRecord(dataset, input),
      }),
  );
}

function registerTaskAndHabitTools(server: McpServer, context: McpContext): void {
  server.registerTool(
    "set_task_status",
    {
      title: "Set a task's status",
      description:
        "Set a task to open, todo, done or skip. done keeps an existing completedAt or stamps the current local time; any other status clears it.",
      inputSchema: { id: recordIdSchema, status: taskStatusSchema },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    (input) =>
      runWrite(context, {
        tool: "set_task_status",
        collections: ["tasks"],
        plan: (dataset, clock) => planSetTaskStatus(dataset, input, clock),
      }),
  );
  server.registerTool(
    "check_in_habit",
    {
      title: "Check in a habit",
      description:
        "Mark a habit's day done (default), skipped or back to todo. date defaults to today in your time zone. When that day has no task yet, one is created, but only if the habit is active, its value isn't archived, and the date is on its schedule, not before it was created and at most 14 days ahead.",
      inputSchema: {
        habitId: recordIdSchema,
        date: isoDateSchema.optional(),
        status: z.enum(["done", "skip", "todo"]).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    (input) =>
      runWrite(context, {
        tool: "check_in_habit",
        collections: ["tasks", "habits", "values"],
        plan: (dataset, clock) => planCheckInHabit(dataset, input, clock),
      }),
  );
  server.registerTool(
    "set_habit_state",
    {
      title: "Pause, resume, archive or unarchive a habit",
      description:
        "Change a habit's lifecycle. pause and archive remove its future undone tasks (history stays); resume and unarchive regenerate the next 14 days. Repeating a call is safe.",
      inputSchema: {
        id: recordIdSchema,
        state: z.enum(["pause", "resume", "archive", "unarchive"]),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    (input) =>
      runWrite(context, {
        tool: "set_habit_state",
        collections: HABIT_COLLECTIONS,
        plan: (dataset, clock) => planSetHabitState(dataset, input, clock),
      }),
  );
}

function registerGoalAndJournalTools(server: McpServer, context: McpContext): void {
  server.registerTool(
    "edit_subgoals",
    {
      title: "Edit a goal's subgoals",
      description:
        "Add subgoals by name, toggle them done/undone, or remove them by id, then recompute the goal's progress as done ÷ total.",
      inputSchema: {
        goalId: recordIdSchema,
        add: z.array(z.string()).optional(),
        toggle: z.array(z.string()).optional(),
        remove: z.array(z.string()).optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: false },
    },
    (input) =>
      runWrite(context, {
        tool: "edit_subgoals",
        collections: ["goals"],
        plan: (dataset) => planEditSubgoals(dataset, input),
      }),
  );
  server.registerTool(
    "write_journal",
    {
      title: "Write a journal entry",
      description:
        "Write the journal entry for a date (default today in your time zone). journal replaces the text, appendJournal adds a line, gratitude replaces the list, mood sets the mood. An entry left with no content is deleted.",
      inputSchema: {
        date: isoDateSchema.optional(),
        journal: z.string().optional(),
        appendJournal: z.string().optional(),
        gratitude: z.array(z.string()).optional(),
        mood: z.number().nullable().optional(),
      },
      annotations: { readOnlyHint: false, destructiveHint: true },
    },
    (input) =>
      runWrite(context, {
        tool: "write_journal",
        collections: ["journal"],
        plan: (dataset, clock) => planWriteJournal(dataset, input, clock),
      }),
  );
}

export const registerWriteTools: ToolRegistrar = (server, context) => {
  if (context.grant.scope !== "write") return;
  registerRecordTools(server, context);
  registerTaskAndHabitTools(server, context);
  registerGoalAndJournalTools(server, context);
};
