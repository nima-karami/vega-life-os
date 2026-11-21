import { type DayEntryCreate, isValidISODate, mergeDayEntry, type WireRow } from "@vega/shared";
import type { StoredEntity } from "../../../core/repository";
import { ToolError } from "../../../core/tool-error";
import type { McpClock } from "../mcp-context";
import { getLoaded, type LoadedDataset } from "./dataset-loader";
import {
  buildGuard,
  buildInsert,
  buildRemove,
  buildUpdate,
  findRow,
  type ParsedPatch,
  type PlanOutcome,
  requireRow,
  toResultRecord,
  withIgnoredKeys,
} from "./plan-support";

type JournalPatch = Partial<Pick<DayEntryCreate, "gratitude" | "mood" | "journal">>;
type StoredEntry = StoredEntity<"journal">;

export type JournalWrite = {
  date?: string;
  journal?: string;
  appendJournal?: string;
  gratitude?: string[];
  mood?: number | null;
};

function assertEntryDate(date: unknown): asserts date is string {
  if (typeof date !== "string" || !isValidISODate(date))
    throw new ToolError("BAD_REQUEST", "journal.date: expected YYYY-MM-DD");
}

const findEntryByDate = (dataset: LoadedDataset, date: string) =>
  getLoaded(dataset, "journal").rows.find((entry) => entry.date === date);

/** The app's merge (trim, caps, empty-discard): an entry that ends up empty is removed, not stored. */
function planEntryMerge(
  dataset: LoadedDataset,
  existing: StoredEntry | undefined,
  entry: { date: string; patch: JournalPatch; newId: string },
  clock: McpClock,
): PlanOutcome {
  const journal = getLoaded(dataset, "journal");
  const prior: WireRow<StoredEntry> | null = existing ? toWireEntry(existing) : null;
  const merged = mergeDayEntry(prior, entry.patch, entry.date, clock.nowIso, () => entry.newId);
  if (merged) {
    const put = existing
      ? buildUpdate("journal", journal, merged)
      : buildInsert("journal", journal, merged);
    return {
      changeSet: {
        operations: [put],
        guards: [buildGuard("journal", "date", merged.date, [merged.id])],
      },
      result: { record: toResultRecord(merged) },
      primary: { collection: "journal", id: merged.id },
    };
  }
  return {
    changeSet: {
      operations: existing ? [buildRemove("journal", journal, existing.id)] : [],
      guards: [],
    },
    result: { record: null, removed: existing ? { journal: [existing.id] } : {} },
  };
}

function toWireEntry(entry: StoredEntry): WireRow<StoredEntry> {
  const { fieldUpdatedAt: _fieldUpdatedAt, ...wire } = entry;
  return wire;
}

function pickJournalPatch(fields: Partial<DayEntryCreate>): JournalPatch {
  const patch: JournalPatch = {};
  if (fields.gratitude !== undefined) patch.gratitude = fields.gratitude;
  if (fields.mood !== undefined) patch.mood = fields.mood;
  if (fields.journal !== undefined) patch.journal = fields.journal;
  return patch;
}

export function planWriteJournal(
  dataset: LoadedDataset,
  input: JournalWrite,
  clock: McpClock,
): PlanOutcome {
  const date = input.date ?? clock.today;
  assertEntryDate(date);
  const existing = findEntryByDate(dataset, date);
  const patch = pickJournalPatch(input);
  if (input.appendJournal !== undefined) {
    const base = patch.journal ?? existing?.journal ?? "";
    patch.journal = base.trim() === "" ? input.appendJournal : `${base}\n${input.appendJournal}`;
  }
  return planEntryMerge(dataset, existing, { date, patch, newId: `day_${date}` }, clock);
}

export function planCreateJournal(
  dataset: LoadedDataset,
  patch: ParsedPatch,
  explicitId: string | undefined,
  clock: McpClock,
): PlanOutcome {
  const fields = patch.fields as Partial<DayEntryCreate>;
  assertEntryDate(fields.date);
  const existing = findEntryByDate(dataset, fields.date);
  const holder = explicitId ? findRow(getLoaded(dataset, "journal"), explicitId) : undefined;
  if (holder && holder.date !== fields.date)
    throw new ToolError("CONFLICT", `journal/${explicitId} already exists for ${holder.date}`);
  if (explicitId && existing && existing.id !== explicitId)
    throw new ToolError("CONFLICT", `journal/${existing.id} already holds ${fields.date}`);
  const outcome = planEntryMerge(
    dataset,
    existing,
    {
      date: fields.date,
      patch: pickJournalPatch(fields),
      newId: explicitId ?? `day_${fields.date}`,
    },
    clock,
  );
  return { ...outcome, result: withIgnoredKeys(outcome.result, patch.ignoredKeys) };
}

export function planUpdateJournal(
  dataset: LoadedDataset,
  id: string,
  patch: ParsedPatch,
  clock: McpClock,
): PlanOutcome {
  const entry = requireRow("journal", getLoaded(dataset, "journal"), id);
  const fields = patch.fields as Partial<DayEntryCreate>;
  const date = fields.date ?? entry.date;
  assertEntryDate(date);
  const holder = findEntryByDate(dataset, date);
  if (holder && holder.id !== id)
    throw new ToolError("CONFLICT", `journal/${holder.id} already holds ${date}`);
  const outcome = planEntryMerge(
    dataset,
    entry,
    { date, patch: pickJournalPatch(fields), newId: id },
    clock,
  );
  return { ...outcome, result: withIgnoredKeys(outcome.result, patch.ignoredKeys) };
}
