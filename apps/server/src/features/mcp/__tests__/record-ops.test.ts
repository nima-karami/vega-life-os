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
    const budget = { categoryId: "fcat_food", month: "2026-11", cents: 100 };
    const outcome = planCreateRecord(
      { financeBudgets: loadRows([]) },
      { collection: "financeBudgets", id: "fcat_food:2026-11", record: budget },
      clock,
    );
    expect(outcome.result.record).toMatchObject({ id: "fcat_food:2026-11" });
    const cases: [Parameters<typeof planCreateRecord>[1], string][] = [
      [{ collection: "financeBudgets", record: budget }, "needs an explicit id"],
      [
        {
          collection: "financeBudgets",
          id: "fcat_food:2026-13",
          record: { ...budget, month: "2026-13" },
        },
        "01-12",
      ],
      [{ collection: "financeSettlements", id: "nov", record: { month: "2026-11" } }, "'YYYY-MM'"],
      [{ collection: "cardPrefs", record: {} }, "needs an explicit id"],
    ];
    for (const [input, message] of cases)
      expectToolError(
        () =>
          planCreateRecord(
            {
              financeBudgets: loadRows([]),
              financeSettlements: loadRows([]),
              cardPrefs: loadRows([]),
            },
            input,
            clock,
          ),
        "BAD_REQUEST",
        message,
      );
  });

  it("checks the natural key again when an update moves the month", () => {
    const dataset: LoadedDataset = {
      financeSettlements: loadRows([{ id: "2026-11", month: "2026-11" }]),
    };
    expectToolError(
      () =>
        planUpdateRecord(
          dataset,
          { collection: "financeSettlements", id: "2026-11", patch: { month: "2026-12" } },
          clock,
        ),
      "BAD_REQUEST",
      "expected 2026-12",
    );
  });

  it("validates record.id and link ids as single record ids", () => {
    expectToolError(
      () => planCreateRecord({}, { collection: "books", record: { id: "a/b" } }, clock),
      "BAD_REQUEST",
      "record.id",
    );
    const taskDataset: LoadedDataset = {
      tasks: loadRows([]),
      habits: loadRows([]),
      goals: loadRows([]),
      values: loadRows([]),
    };
    expectToolError(
      () =>
        planCreateRecord(taskDataset, { collection: "tasks", record: { goalId: "g/x" } }, clock),
      "BAD_REQUEST",
      "goalId",
    );
  });

  it("lists an inherited property name as an ignored key instead of failing", () => {
    const outcome = planCreateRecord(
      { books: loadRows([]) },
      { collection: "books", record: { title: "x", toString: 1 } },
      clock,
    );
    expect(outcome.result.ignoredKeys).toEqual(["toString"]);
  });

  it("trims a card's category before its length limit applies", () => {
    const category = ` ${"c".repeat(60)} `;
    const outcome = planCreateRecord(
      { cards: loadRows([]) },
      {
        collection: "cards",
        record: {
          type: "note",
          category,
          title: "T",
          body: "B",
          addedAt: "2026-11-20",
          box: null,
          lastReviewed: null,
          nextDue: null,
        },
      },
      clock,
    );
    expect(outcome.result.record).toMatchObject({ category: "c".repeat(60) });
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
    let digest = "";
    try {
      planDeleteRecord(dataset, { collection: "financeCategories", id: "fcat_fun" });
    } catch (error) {
      digest = String((error as { detail?: { confirmCascade?: string } }).detail?.confirmCascade);
    }
    expect(digest).toMatch(/^[0-9a-f]{16}$/);
    const outcome = planDeleteRecord(dataset, {
      collection: "financeCategories",
      id: "fcat_fun",
      confirmCascade: digest,
    });
    expect(outcome.changeSet.operations.map((operation) => operation.kind)).toEqual([
      "remove",
      "remove",
    ]);
    expect(outcome.changeSet.guards).toEqual([
      {
        collection: "financeTransactions",
        field: "categoryId",
        value: "fcat_fun",
        expectedIds: [],
      },
      {
        collection: "financeMerchants",
        field: "defaultCategoryId",
        value: "fcat_fun",
        expectedIds: [],
      },
      { collection: "financeBudgets", field: "categoryId", value: "fcat_fun", expectedIds: [] },
    ]);
    expect(listRequiredCollections("financeCategories")).toContain("financeBudgets");
  });
});

describe("generic delete", () => {
  it("removes a plain record against its snapshot and reports a missing one", () => {
    const dataset: LoadedDataset = { movies: loadRows([{ id: "m_1" }]) };
    expect(
      planDeleteRecord(dataset, { collection: "movies", id: "m_1" }).changeSet.operations,
    ).toEqual([
      {
        kind: "remove",
        collection: "movies",
        id: "m_1",
        expect: { updateTime: "@m_1" },
        storedBytes: 0,
      },
    ]);
    expectToolError(
      () => planDeleteRecord(dataset, { collection: "movies", id: "m_2" }),
      "NOT_FOUND",
    );
  });
});
