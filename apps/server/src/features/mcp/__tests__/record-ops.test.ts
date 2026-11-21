import { describe, expect, it } from "vitest";
import { createLoadedCollection, type LoadedDataset } from "../ops/dataset-loader";
import {
  listRequiredCollections,
  planCreateRecord,
  planDeleteRecord,
  planUpdateRecord,
} from "../ops/record-ops";
import { computeZonedClock } from "../zoned-clock";

const clock = computeZonedClock("America/Toronto", Date.parse("2026-11-20T18:00:00Z"));
const STORED = { updatedAt: "2026-07-07T00:00:00.000Z", fieldUpdatedAt: {} };

// Partial fixtures: each test only carries the fields the planner under test reads.
const loadRows = (rows: Record<string, unknown>[]) =>
  createLoadedCollection<never>(
    rows.map((row) => ({ row: { ...row, ...STORED } as never, updateTime: `@${row.id}` })),
  );

const prefs = {
  id: "feed",
  mode: "mix",
  types: [],
  categories: [],
  view: "rows",
  migratedAt: "2026-06-01T00:00:00.000Z",
};

const expectToolError = (run: () => unknown, code: string, message?: string) =>
  expect(run).toThrow(
    expect.objectContaining({
      code,
      ...(message ? { message: expect.stringContaining(message) } : {}),
    }),
  );

describe("generic create", () => {
  it("refuses a read-only collection, naming the writable set", () => {
    expectToolError(
      () => planCreateRecord({}, { collection: "calendarEvents", record: {} }, clock),
      "BAD_REQUEST",
      "writable: values",
    );
  });

  it("fills a prefixed id and order = count, and lists unknown keys", () => {
    const dataset: LoadedDataset = { books: loadRows([{ id: "b_1" }]) };
    const outcome = planCreateRecord(
      dataset,
      { collection: "books", record: { title: "Dune", colour: "blue", updatedAt: "x" } },
      clock,
    );
    expect(outcome.result).toMatchObject({
      record: { title: "Dune", order: 1 },
      ignoredKeys: ["colour"],
    });
    expect((outcome.result.record as { id: string }).id).toMatch(/^b_/);
  });

  it("rejects disagreeing ids and refuses a field with the wrong type", () => {
    expectToolError(
      () => planCreateRecord({}, { collection: "books", record: { id: "b_a" }, id: "b_b" }, clock),
      "BAD_REQUEST",
    );
    expectToolError(
      () =>
        planCreateRecord(
          { books: loadRows([]) },
          { collection: "books", record: { pages: "many" } },
          clock,
        ),
      "BAD_REQUEST",
      "books.pages",
    );
  });

  it("enforces the natural keys of budgets and settlements", () => {
    const outcome = planCreateRecord(
      { financeBudgets: loadRows([]) },
      {
        collection: "financeBudgets",
        record: { categoryId: "fcat_food", month: "2026-11", cents: 100 },
      },
      clock,
    );
    expect(outcome.result.record).toMatchObject({ id: "fcat_food:2026-11" });
    expectToolError(
      () =>
        planCreateRecord(
          { financeSettlements: loadRows([]) },
          { collection: "financeSettlements", record: { month: "2026-11" }, id: "nov" },
          clock,
        ),
      "BAD_REQUEST",
      "'YYYY-MM'",
    );
  });

  it("normalises a card's category and clears slots its type doesn't use", () => {
    const outcome = planCreateRecord(
      { cards: loadRows([]) },
      {
        collection: "cards",
        record: {
          type: "note",
          category: "  Ideas ",
          title: "T",
          body: "B",
          author: "someone",
          addedAt: "2026-11-20",
          box: null,
          lastReviewed: null,
          nextDue: null,
        },
      },
      clock,
    );
    expect(outcome.result.record).toMatchObject({ category: "Ideas", author: null });
  });
});

describe("protected fields and cardPrefs", () => {
  it("routes habit lifecycle fields to set_habit_state", () => {
    expectToolError(
      () =>
        planUpdateRecord(
          {},
          { collection: "habits", id: "h_1", patch: { pausedAt: "2026-11-20T00:00:00Z" } },
          clock,
        ),
      "BAD_REQUEST",
      "set_habit_state",
    );
  });

  it("keeps cardPrefs.migratedAt on update and refuses to patch it or delete the record", () => {
    const dataset: LoadedDataset = { cardPrefs: loadRows([prefs]) };
    const outcome = planUpdateRecord(
      dataset,
      { collection: "cardPrefs", id: "feed", patch: { mode: "due" } },
      clock,
    );
    expect(outcome.result.record).toMatchObject({ mode: "due", migratedAt: prefs.migratedAt });
    expectToolError(
      () =>
        planUpdateRecord(
          dataset,
          { collection: "cardPrefs", id: "feed", patch: { migratedAt: null } },
          clock,
        ),
      "BAD_REQUEST",
      "migratedAt",
    );
    expectToolError(
      () => planDeleteRecord(dataset, { collection: "cardPrefs", id: "feed" }),
      "BAD_REQUEST",
    );
  });

  it("refuses an id change in a patch", () => {
    expectToolError(
      () =>
        planUpdateRecord(
          { books: loadRows([{ id: "b_1" }]) },
          { collection: "books", id: "b_1", patch: { id: "b_2" } },
          clock,
        ),
      "BAD_REQUEST",
      "id can't be changed",
    );
  });
});

describe("finance category delete", () => {
  const categoryDataset = (transactions: Record<string, unknown>[]): LoadedDataset => ({
    financeCategories: loadRows([{ id: "fcat_fun" }]),
    financeTransactions: loadRows(transactions),
    financeMerchants: loadRows([]),
    financeBudgets: loadRows([{ id: "fcat_fun:2026-11", categoryId: "fcat_fun" }]),
  });

  it("refuses a category a transaction still uses", () => {
    expectToolError(
      () =>
        planDeleteRecord(categoryDataset([{ id: "ftxn_1", categoryId: "fcat_fun" }]), {
          collection: "financeCategories",
          id: "fcat_fun",
        }),
      "BAD_REQUEST",
      "1 transaction",
    );
  });

  it("cascades an unused category's budgets behind a confirmation, guarded on references", () => {
    const dataset = categoryDataset([]);
    expectToolError(
      () => planDeleteRecord(dataset, { collection: "financeCategories", id: "fcat_fun" }),
      "CONFIRM_REQUIRED",
    );
    expect(listRequiredCollections("financeCategories")).toContain("financeBudgets");
  });
});

describe("generic delete", () => {
  it("removes a plain record against its snapshot and reports a missing one", () => {
    const dataset: LoadedDataset = { movies: loadRows([{ id: "m_1" }]) };
    expect(
      planDeleteRecord(dataset, { collection: "movies", id: "m_1" }).changeSet.operations,
    ).toEqual([
      { kind: "remove", collection: "movies", id: "m_1", expect: { updateTime: "@m_1" } },
    ]);
    expectToolError(
      () => planDeleteRecord(dataset, { collection: "movies", id: "m_2" }),
      "NOT_FOUND",
    );
  });
});
