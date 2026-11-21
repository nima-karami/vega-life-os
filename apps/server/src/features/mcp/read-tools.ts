import {
  type CollectionName,
  createSchemasByCollection,
  describeRecurrence,
  isHabitActive,
  isValidTimeZone,
  normalizeHabit,
  schemasByCollection,
} from "@vega/shared";
import { z } from "zod";
import { createRepository } from "../../core/repository";
import { toWireRow, toWireRows } from "../../core/wire";
import { SCOPE_VERSION } from "../calendar/oauth";
import { readGcalAccount } from "../calendar/token-store";
import { buildDayView } from "./day-view";
import {
  COLLECTION_NOTES,
  ID_PREFIX,
  isDeletableCollection,
  isWritableCollection,
  MCP_COLLECTIONS,
  type McpCollection,
  mcpCollectionSchema,
  RECORD_ID_PATTERN,
} from "./mcp-collections";
import type { McpContext, ToolRegistrar } from "./mcp-context";
import { queryRecords } from "./record-query";
import { ToolError, toToolFailure, toToolSuccess } from "./tool-result";

const READ_ONLY = { readOnlyHint: true } as const;

function getRepository<Collection extends CollectionName>(
  { firestore, grant }: McpContext,
  collection: Collection,
) {
  return createRepository(firestore, grant.uid, collection);
}

async function fetchRows<Collection extends CollectionName>(
  context: McpContext,
  collection: Collection,
) {
  return toWireRows(await getRepository(context, collection).list());
}

async function fetchOtherCounts(context: McpContext) {
  const collections = MCP_COLLECTIONS.filter(
    (collection) => collection !== "values" && collection !== "goals" && collection !== "habits",
  );
  return Object.fromEntries(
    await Promise.all(
      collections.map(async (collection) => [
        collection,
        (
          await context.firestore
            .collection(`users/${context.grant.uid}/${collection}`)
            .count()
            .get()
        ).data().count,
      ]),
    ),
  );
}

async function fetchOverview(context: McpContext) {
  const { firestore, grant } = context;
  const { today } = context.clock();
  const [values, goals, habits, otherCounts, profile, account] = await Promise.all([
    fetchRows(context, "values"),
    fetchRows(context, "goals"),
    fetchRows(context, "habits"),
    fetchOtherCounts(context),
    firestore.doc(`users/${grant.uid}`).get(),
    readGcalAccount(firestore, grant.uid),
  ]);
  const profileName = profile.get("name");

  return {
    today,
    counts: { ...otherCounts, values: values.length, goals: goals.length, habits: habits.length },
    activeValues: values
      .filter(({ archivedAt }) => !archivedAt)
      .map(({ id, name }) => ({ id, name })),
    activeGoals: goals
      .filter(({ status }) => status === "active")
      .map(({ id, name, progress, end }) => ({ id, name, progress, end })),
    activeHabits: habits.filter(isHabitActive).map((habit) => ({
      id: habit.id,
      name: habit.name,
      scheduleSummary: describeRecurrence(normalizeHabit(habit, today).schedule),
    })),
    profileName: typeof profileName === "string" ? profileName : null,
    gcalConnected: Boolean(
      account?.refreshTokenCipher &&
        !account.needsReauth &&
        !(account.scopeVersion < SCOPE_VERSION),
    ),
    ...(isValidTimeZone(grant.timeZone ?? "")
      ? {}
      : { note: "Invalid or missing token time zone. Using UTC." }),
  };
}

async function fetchDay(context: McpContext, date = context.clock().today) {
  const [tasks, events, journal] = await Promise.all([
    fetchRows(context, "tasks"),
    fetchRows(context, "calendarEvents"),
    fetchRows(context, "journal"),
  ]);
  return buildDayView(date, tasks, events, journal.find((entry) => entry.date === date) ?? null);
}

async function fetchRecord(context: McpContext, collection: McpCollection, id: string) {
  const record = await getRepository(context, collection).get(id);
  if (!record) throw new ToolError("NOT_FOUND", "record not found");
  return { record: toWireRow(record) };
}

function describeCollection(collection: McpCollection) {
  const createSchema = createSchemasByCollection[collection];
  const schema = z.toJSONSchema(createSchema, {
    io: "input",
    override: ({ path, jsonSchema }) => {
      if (path.length === 0 && Array.isArray(jsonSchema.required)) {
        jsonSchema.required = jsonSchema.required.filter((key) => key !== "id");
      }
    },
  });
  return {
    schema,
    idPrefix: ID_PREFIX[collection],
    writable: isWritableCollection(collection),
    deletable: isDeletableCollection(collection),
    notes: COLLECTION_NOTES[collection],
  };
}

async function runReadTool(
  { grant }: McpContext,
  tool: string,
  read: () => Record<string, unknown> | Promise<Record<string, unknown>>,
) {
  console.log({ uid: grant.uid, tokenId: grant.tokenId, tool });
  try {
    return toToolSuccess(await read());
  } catch (error) {
    return toToolFailure(error);
  }
}

const listInput = {
  collection: mcpCollectionSchema,
  where: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
  search: z.string().optional(),
  limit: z.number().int().min(1).max(200).optional(),
  cursor: z.string().optional(),
};

export const registerReadTools: ToolRegistrar = (server, context) => {
  server.registerTool(
    "get_overview",
    {
      title: "Get VEGA overview",
      description:
        "Call this first to find today's date, the owner's profile and calendar status, collection counts, and active values, goals, and habits.",
      inputSchema: {},
      annotations: READ_ONLY,
    },
    () => runReadTool(context, "get_overview", () => fetchOverview(context)),
  );
  server.registerTool(
    "get_day",
    {
      title: "Get day",
      description:
        "Get a date's scheduled and anytime tasks, split by completion, plus calendar events and the journal entry. Omit date to use today in the token owner's time zone.",
      inputSchema: { date: z.iso.date().optional() },
      annotations: READ_ONLY,
    },
    ({ date }) => runReadTool(context, "get_day", () => fetchDay(context, date)),
  );
  server.registerTool(
    "list_records",
    {
      title: "List records",
      description:
        "Page through a collection. Each call reads the entire collection before filtering. Use where for exact scalar field matches, search for a case-insensitive substring, and nextCursor to continue with the same filters. Defaults to 50 rows, with a maximum of 200. Fetch rows marked oversized with get_record.",
      inputSchema: listInput,
      annotations: READ_ONLY,
    },
    ({ collection, ...options }) =>
      runReadTool(context, "list_records", async () =>
        queryRecords(await fetchRows(context, collection), {
          ...options,
          schemaKeys: Object.keys(schemasByCollection[collection].shape).filter(
            (key) => key !== "fieldUpdatedAt",
          ),
        }),
      ),
  );
  server.registerTool(
    "get_record",
    {
      title: "Get record",
      description:
        "Fetch a single record by collection and ID, including records marked oversized by list_records.",
      inputSchema: { collection: mcpCollectionSchema, id: z.string().regex(RECORD_ID_PATTERN) },
      annotations: READ_ONLY,
    },
    ({ collection, id }) =>
      runReadTool(context, "get_record", () => fetchRecord(context, collection, id)),
  );
  server.registerTool(
    "describe_collection",
    {
      title: "Describe collection",
      description:
        "Get a collection's JSON Schema for creating records, ID prefix, write capabilities, and domain rules.",
      inputSchema: { collection: mcpCollectionSchema },
      annotations: READ_ONLY,
    },
    ({ collection }) =>
      runReadTool(context, "describe_collection", () => describeCollection(collection)),
  );
};
