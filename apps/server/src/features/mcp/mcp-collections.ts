import { COLLECTIONS, type CollectionName } from "@vega/shared";
import { z } from "zod";

export type McpCollection = Exclude<CollectionName, "mindCards" | "mindMeta">;

const RETIRED_COLLECTIONS: ReadonlySet<CollectionName> = new Set(["mindCards", "mindMeta"]);

export const MCP_COLLECTIONS = COLLECTIONS.filter(
  (collection): collection is McpCollection => !RETIRED_COLLECTIONS.has(collection),
);

export const mcpCollectionSchema = z.enum(MCP_COLLECTIONS as [McpCollection, ...McpCollection[]]);

const READ_ONLY_COLLECTIONS: ReadonlySet<McpCollection> = new Set([
  "calendarEvents",
  "financeImportBatches",
]);

export function isWritableCollection(collection: McpCollection): boolean {
  return !READ_ONLY_COLLECTIONS.has(collection);
}

export function isDeletableCollection(collection: McpCollection): boolean {
  return isWritableCollection(collection) && collection !== "cardPrefs";
}

export const PROTECTED_FIELDS: Partial<Record<McpCollection, readonly string[]>> = {
  cardPrefs: ["migratedAt"],
  habits: ["archivedAt", "pausedAt", "resumedAt", "pausedSpans"],
};

export const ID_PREFIX: Record<McpCollection, string> = {
  values: "v_",
  goals: "g_",
  habits: "h_",
  tasks: "t_",
  books: "b_",
  movies: "m_",
  vocab: "w_",
  reviews: "rv_",
  journal: "day_",
  calendarEvents: "",
  financeAccounts: "facc_",
  financeCategories: "fcat_",
  financeBudgets: "",
  financeMerchants: "fmer_",
  financeImportBatches: "fbat_",
  financeTransactions: "ftxn_",
  financeSettlements: "",
  cards: "c_",
  cardPrefs: "",
};

export const RECORD_ID_PATTERN = /^(?!\.\.?$)(?!__.*__$)[A-Za-z0-9_:@.-]{1,128}$/;

export const COLLECTION_NOTES: Record<McpCollection, string> = {
  values:
    "Core values everything ladders up to. Deleting a value also deletes its goals, its habits and every task linked to them (needs confirmCascade). Archiving keeps all tasks and only stops its habits from generating new ones.",
  goals:
    "Goals under a value, with dated start/end and subgoals. progress is derived from subgoals when there are any; use edit_subgoals to change them. Deleting a goal unlinks its habits and tasks (needs confirmCascade).",
  habits:
    "Recurring habits with a weekly or monthly schedule. VEGA generates one task per scheduled day, 14 days ahead. Use check_in_habit to mark a day, set_habit_state to pause/resume/archive. Deleting a habit deletes all its tasks (needs confirmCascade).",
  tasks:
    "Tasks: one-offs and habit instances (kind 'habit'). Use set_task_status to complete or skip. Clearing date unschedules (status todo becomes open). Change one thing per update_record call: date, habit link, or status.",
  books: "Reading list entries.",
  movies: "Watch list entries.",
  vocab: "Vocabulary entries with Leitner review state.",
  reviews:
    "Weekly/periodic reviews. One review per periodKey: creating one for an existing period updates it.",
  journal:
    "One journal entry per date (YYYY-MM-DD) with gratitude, mood and text. Prefer write_journal; an entry left empty is deleted.",
  calendarEvents: "Read-only mirror of Google Calendar events. VEGA's calendar sync owns writes.",
  financeAccounts: "Finance accounts.",
  financeCategories:
    "Spending categories. A category still used by a transaction or merchant can't be deleted; deleting an unused one also deletes its budgets (needs confirmCascade).",
  financeBudgets: "Monthly budgets. The id must be '<categoryId>:<YYYY-MM>'.",
  financeMerchants: "Merchants with an optional default category.",
  financeImportBatches: "Read-only record of statement imports. Imports happen in the app.",
  financeTransactions: "Finance transactions.",
  financeSettlements: "Monthly settlements. The id must be the month, 'YYYY-MM'.",
  cards:
    "Knowledge cards. The category is normalised and fields the card type doesn't use are cleared.",
  cardPrefs:
    "The single card-feed preferences record, id 'feed'. migratedAt is managed by VEGA and can't be changed; this record can't be deleted.",
};
