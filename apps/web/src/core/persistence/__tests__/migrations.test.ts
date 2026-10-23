import { type Card, DEFAULT_CARD_PREFS, type MindCard, type MindMetaRecord } from "@vega/shared";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { saveBulkPut, saveBulkRemove, savePut, saveRemove } from "@/core/store/persist";
import type { Habit } from "@/features/habits/model";
import { normalizeHabit } from "@/features/habits/recurrence";
import type { VocabEntry } from "@/features/library/model";
import type { Task } from "@/features/tasks/model";
import { RETIRED_HUE_REPLACEMENT } from "@/features/values/color";
import type { Value } from "@/features/values/model";
import type { Dataset } from "../adapter";
import { DATA_VERSION, hasMigrationSources, migrateData, runDataMigrations } from "../migrations";

vi.mock("@/core/store/persist", () => ({
  savePut: vi.fn(),
  saveRemove: vi.fn(),
  saveBulkPut: vi.fn(async () => ({
    landedRows: 0,
    writtenChunks: 1,
    failedChunk: null,
    result: { inserted: 0, skipped: 0, writtenChunks: 1 },
  })),
  saveBulkRemove: vi.fn(async () => ({})),
}));

/** The rows each collection's bulk writes carried, by collection. */
function bulkWrites(): Record<string, string[]> {
  const written: Record<string, string[]> = {};
  for (const [col, rows] of vi.mocked(saveBulkPut).mock.calls)
    written[col] = [...(written[col] ?? []), ...(rows as { id: string }[]).map((row) => row.id)];
  return written;
}

function bulkRemovals(): Record<string, string[]> {
  const removed: Record<string, string[]> = {};
  for (const [col, ids] of vi.mocked(saveBulkRemove).mock.calls)
    removed[col] = [...(removed[col] ?? []), ...ids];
  return removed;
}

const legacyHabit = (over: Partial<Habit> = {}): Habit =>
  ({
    id: "h1",
    name: "Water plants",
    goalId: null,
    valueId: "v1",
    icon: "repeat",
    time: null,
    durationMin: 30,
    createdAt: "2026-06-01",
    archivedAt: null,
    schedule: { type: "monthly", daysOfMonth: [15], lastDay: false },
    // retired fields a stored record still carries:
    days: [1, 1, 1, 1, 1, 1, 1],
    recurrence: "Monthly on the 15th",
    ...over,
  }) as unknown as Habit;

const task = (over: Partial<Task>): Task =>
  ({
    id: "t",
    title: "Water plants",
    kind: "habit",
    habitId: "h1",
    goalId: null,
    valueId: "v1",
    date: "2999-01-02", // far future, a non-15th day → does not match the schedule
    time: null,
    durationMin: 30,
    status: "todo",
    detached: false,
    note: "",
    order: 0,
    ...over,
  }) as Task;

const value = (over: Partial<Value> = {}): Value =>
  ({ id: "v1", name: "Stability", icon: "shield", order: 0, archivedAt: null, ...over }) as Value;

function harness(authUid: string | null, habits: Habit[], tasks: Task[], values: Value[] = []) {
  let state = {
    authUid,
    habits,
    tasks,
    values,
    cards: [] as Card[],
    cardPrefs: DEFAULT_CARD_PREFS,
    mindCards: [] as MindCard[],
    mindMeta: [] as MindMetaRecord[],
    vocab: [] as VocabEntry[],
    toasts: [] as string[],
    pushToast: (message: string) => {
      state.toasts.push(message);
    },
  };
  const get = () => state;
  const set = (patch: Partial<typeof state>) => {
    state = { ...state, ...patch };
  };
  return { get, set, state: () => state };
}

describe("migrateData (pure)", () => {
  it("strips legacy fields and prunes only future-undone-non-detached mismatches", () => {
    const { habits, prunedTaskIds } = migrateData({
      values: [],
      habits: [legacyHabit()],
      tasks: [
        task({ id: "stale", status: "todo", detached: false, date: "2999-01-02" }),
        task({ id: "done", status: "done", detached: false, date: "2999-01-03" }),
        task({ id: "detached", status: "todo", detached: true, date: "2999-01-04" }),
        task({ id: "match", date: "2999-01-15" }), // 15th → matches, kept
      ],
    });
    expect("days" in habits[0]).toBe(false);
    expect("recurrence" in habits[0]).toBe(false);
    expect(habits[0].schedule).toEqual({ type: "monthly", daysOfMonth: [15], lastDay: false });
    expect(prunedTaskIds).toEqual(["stale"]);
  });

  it("backfills slotDate and completedAt (existing dones treated as on-time)", () => {
    const { tasks } = migrateData({
      values: [],
      habits: [legacyHabit()],
      tasks: [
        task({ id: "open", status: "todo", date: "2999-01-15" }),
        task({ id: "fin", status: "done", date: "2999-01-15" }),
      ],
    });
    const byId = Object.fromEntries(tasks.map((t) => [t.id, t]));
    expect(byId.open.slotDate).toBe("2999-01-15");
    expect(byId.open.completedAt).toBeNull();
    expect(byId.fin.slotDate).toBe("2999-01-15");
    expect(byId.fin.completedAt).toBe("2999-01-15"); // on-time backfill
  });

  it("dedupes duplicate habitId@slotDate, keeping the resolved instance", () => {
    const { prunedTaskIds } = migrateData({
      values: [],
      habits: [legacyHabit()],
      tasks: [
        task({ id: "dup-todo", status: "todo", date: "2999-01-15" }),
        task({ id: "dup-done", status: "done", date: "2999-01-15" }),
      ],
    });
    expect(prunedTaskIds).toEqual(["dup-todo"]);
  });

  it("moves values off retired hues and reports only the ones it touched", () => {
    const [retired, replacement] = Object.entries(RETIRED_HUE_REPLACEMENT)[0];
    const { values, rehuedValueIds } = migrateData({
      values: [
        value({ id: "keep", hue: "#3B82C4" }),
        value({ id: "retired", hue: retired }),
        value({ id: "unset", hue: undefined }),
      ],
      habits: [legacyHabit()],
      tasks: [],
    });
    expect(rehuedValueIds).toEqual(["retired"]);
    expect(values.map((v) => v.hue)).toEqual(["#3B82C4", replacement, undefined]);
  });
});

describe("runDataMigrations (gated + idempotent)", () => {
  beforeEach(() => vi.clearAllMocks());

  it("persists normalized habits, prunes stale instances, then no-ops on re-run", async () => {
    const h = harness(
      "u-mig-1",
      [legacyHabit()],
      [
        task({ id: "stale", date: "2999-01-02" }),
        task({ id: "keep-done", status: "done", date: "2999-01-15" }),
      ],
    );

    await runDataMigrations(h.get, h.set, true);

    // persists the normalized habit + the surviving (backfilled) task, one bulk call each
    expect(bulkWrites()).toEqual({ habits: ["h1"], tasks: ["keep-done"] });
    expect(saveBulkPut).toHaveBeenCalledTimes(2);
    expect(bulkRemovals()).toEqual({ tasks: ["stale"] });
    expect(saveRemove).not.toHaveBeenCalled();
    // cardPrefs too: a v4 pass that converts nothing still stamps, or a second device re-runs.
    expect(vi.mocked(savePut).mock.calls.map((c) => c[0])).toEqual(["cardPrefs"]);
    expect(h.state().tasks.map((t) => t.id)).toEqual(["keep-done"]);
    expect(h.state().tasks[0].slotDate).toBe("2999-01-15"); // backfilled
    expect("days" in h.state().habits[0]).toBe(false);

    // Second run with the marker now at DATA_VERSION → fully idempotent.
    vi.clearAllMocks();
    await runDataMigrations(h.get, h.set, true);
    expect(savePut).not.toHaveBeenCalled();
    expect(saveBulkPut).not.toHaveBeenCalled();
    expect(saveBulkRemove).not.toHaveBeenCalled();
    expect(DATA_VERSION).toBe(4);
  });

  it("persists only the values whose retired hue it rewrote", async () => {
    const [retired, replacement] = Object.entries(RETIRED_HUE_REPLACEMENT)[0];
    const h = harness("u-mig-2", [], [], [value({ id: "a", hue: retired }), value({ id: "b" })]);

    await runDataMigrations(h.get, h.set, true);

    expect(bulkWrites()).toEqual({ values: ["a"] });
    expect(h.state().values.map((v) => v.hue)).toEqual([replacement, undefined]);
  });

  it("writes only the rows the transform changed, one bulk call per collection", async () => {
    const migratedHabit = normalizeHabit(legacyHabit({ id: "h-clean" }));
    const h = harness(
      "u-mig-diff",
      [legacyHabit(), migratedHabit],
      [
        task({ id: "needs-slot", date: "2999-01-15" }),
        task({ id: "clean", date: "2999-02-15", slotDate: "2999-02-15", completedAt: null }),
      ],
    );

    await runDataMigrations(h.get, h.set, true);

    expect(bulkWrites()).toEqual({ habits: ["h1"], tasks: ["needs-slot"] });
    expect(saveBulkPut).toHaveBeenCalledTimes(2);
  });

  it("a fresh profile on an already-migrated account writes nothing", async () => {
    // Signed in is cloud-only: a new browser has no marker, so the pass re-runs over cloud rows.
    const migrated = migrateData({
      habits: [legacyHabit()],
      tasks: [
        task({ id: "done", status: "done", date: "2999-01-15" }),
        task({ id: "todo", date: "2999-02-15" }),
        task({ id: "one-off", kind: "oneoff", habitId: null }),
      ],
      values: [value({ id: "a", hue: Object.entries(RETIRED_HUE_REPLACEMENT)[0][0] })],
    });
    // a stored null can come back as an absent key; the pass must read that as unchanged
    const tasks = migrated.tasks.map(({ slotDate, ...rest }) =>
      rest.id === "one-off" ? rest : { ...rest, slotDate },
    );
    const h = harness("u-mig-fresh-profile", migrated.habits, tasks, migrated.values);

    await runDataMigrations(h.get, h.set, true);

    expect(saveBulkPut).not.toHaveBeenCalled();
    expect(saveBulkRemove).not.toHaveBeenCalled();
    expect(vi.mocked(savePut).mock.calls.map((c) => c[0])).toEqual(["cardPrefs"]);
    expect(saveRemove).not.toHaveBeenCalled();
  });
});

const sourceCard = (over: Partial<MindCard> = {}): MindCard =>
  ({
    id: "mc_1",
    title: "Inversion",
    body: "**Solve it backward.**",
    type: "note",
    origin: "manual",
    category: "mental models",
    source: null,
    addedAt: "2026-06-01",
    hiddenAt: null,
    likedAt: null,
    flippable: true,
    box: null,
    lastReviewed: null,
    nextDue: null,
    updatedAt: "2026-06-02T09:00:00.000Z",
    fieldUpdatedAt: {},
    ...over,
  }) as MindCard;

const sourceWord = (over: Partial<VocabEntry> = {}): VocabEntry =>
  ({
    id: "w1",
    term: "petrichor",
    definition: "The smell after rain.",
    example: "",
    phonetic: "",
    examples: [],
    synonyms: [],
    language: "English",
    box: 3,
    lastReviewed: "2026-06-10",
    nextDue: "2026-06-14",
    addedAt: "2026-05-20",
    ...over,
  }) as VocabEntry;

/** Each case gets its own uid so its version marker is its own. */
function cardsHarness(
  uid: string,
  sources: { mindCards?: MindCard[]; vocab?: VocabEntry[]; mindMeta?: MindMetaRecord[] } = {},
) {
  const h = harness(uid, [], [], []);
  h.set({
    mindCards: sources.mindCards ?? [sourceCard()],
    mindMeta: sources.mindMeta ?? [],
    vocab: sources.vocab ?? [sourceWord()],
  });
  return h;
}

describe("migration v4 — cards", () => {
  beforeEach(() => vi.clearAllMocks());

  it("hasMigrationSources requires every collection the pass reads or guards on", () => {
    const loaded: Partial<Dataset> = {
      cards: [],
      cardPrefs: [],
      mindCards: [],
      mindMeta: [],
      vocab: [],
    };
    expect(hasMigrationSources(loaded)).toBe(true);
    for (const missing of ["cards", "cardPrefs", "mindCards", "mindMeta", "vocab"] as const) {
      expect(hasMigrationSources({ ...loaded, [missing]: undefined }), missing).toBe(false);
    }
    expect(hasMigrationSources({})).toBe(false);
  });

  it("converts both sources in one batch, stamps the record, tells the user once, then no-ops", async () => {
    const h = cardsHarness("u-cards-1");
    await runDataMigrations(h.get, h.set, true);

    expect(h.state().cards.map((c) => c.id)).toEqual(["mc_1", "w1"]);
    expect(h.state().cards[0].body).toBe("Solve it backward.");
    expect(h.state().cards[1]).toMatchObject({ type: "vocabulary", box: 3, nextDue: "2026-06-14" });
    expect(saveBulkPut).toHaveBeenCalledTimes(1);
    expect(vi.mocked(saveBulkPut).mock.calls[0][0]).toBe("cards");
    expect(h.state().toasts).toHaveLength(1);
    expect(h.state().cardPrefs.migratedAt).not.toBeNull();
    expect(savePut).toHaveBeenCalledWith("cardPrefs", h.state().cardPrefs);

    vi.clearAllMocks();
    await runDataMigrations(h.get, h.set, true);
    expect(saveBulkPut).not.toHaveBeenCalled();
    expect(h.state().cards).toHaveLength(2);
    expect(DATA_VERSION).toBe(4);
  });

  it("stamps the record even when the account had nothing to convert", async () => {
    const h = cardsHarness("u-cards-7", { mindCards: [], vocab: [] });
    await runDataMigrations(h.get, h.set, true);

    expect(h.state().cards).toEqual([]);
    expect(saveBulkPut).not.toHaveBeenCalled();
    expect(h.state().toasts).toEqual([]);
    expect(h.state().cardPrefs.migratedAt).not.toBeNull();
    expect(savePut).toHaveBeenCalledWith("cardPrefs", h.state().cardPrefs);
  });

  // The guard that stops a second device, a cleared profile or a new browser resurrecting
  // every card deleted since the first device migrated.
  it("skips the conversion outright when the hydrated prefs already carry a stamp", async () => {
    const h = cardsHarness("u-cards-8");
    h.set({
      cardPrefs: { ...DEFAULT_CARD_PREFS, migratedAt: "2026-08-11T09:00:00.000Z" },
      cards: [],
    });
    await runDataMigrations(h.get, h.set, true);

    expect(h.state().cards, "a deleted card must not come back").toEqual([]);
    expect(saveBulkPut).not.toHaveBeenCalled();
    expect(savePut).not.toHaveBeenCalledWith("cardPrefs", expect.anything());
  });

  it("advances the local marker on the device that skipped, so it stops re-checking", async () => {
    const h = cardsHarness("u-cards-9");
    h.set({ cardPrefs: { ...DEFAULT_CARD_PREFS, migratedAt: "2026-08-11T09:00:00.000Z" } });
    await runDataMigrations(h.get, h.set, true);

    // Clearing the stamp cannot make it run again: the local marker is already at 4.
    h.set({ cardPrefs: DEFAULT_CARD_PREFS });
    await runDataMigrations(h.get, h.set, true);
    expect(saveBulkPut).not.toHaveBeenCalled();
  });

  it("keeps a preference the user changed between passes, and only adds the stamp", async () => {
    const h = cardsHarness("u-cards-10", {
      mindCards: [sourceCard()],
      vocab: [sourceWord({ id: "w_broken", definition: "" })],
    });
    await runDataMigrations(h.get, h.set, true);
    expect(h.state().cardPrefs.migratedAt, "an incomplete pass must not stamp").toBeNull();

    h.set({ cardPrefs: { ...h.state().cardPrefs, view: "gallery", mode: "due" } });
    h.set({ vocab: [sourceWord()] });
    await runDataMigrations(h.get, h.set, true);

    expect(h.state().cardPrefs).toMatchObject({ view: "gallery", mode: "due" });
    expect(h.state().cardPrefs.migratedAt).not.toBeNull();
  });

  it("does not run at all when the sources have not hydrated, and retries next boot", async () => {
    const h = cardsHarness("u-cards-2");
    await runDataMigrations(h.get, h.set, false);
    expect(h.state().cards).toEqual([]);
    expect(saveBulkPut).not.toHaveBeenCalled();

    await runDataMigrations(h.get, h.set, true);
    expect(h.state().cards.map((c) => c.id)).toEqual(["mc_1", "w1"]);
    expect(saveBulkPut).toHaveBeenCalledTimes(1);
  });

  it("skips a record it cannot convert, reports it, and keeps re-running until it is fixed", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = cardsHarness("u-cards-3", {
      mindCards: [sourceCard()],
      vocab: [sourceWord({ id: "w_broken", definition: "" })],
    });
    await runDataMigrations(h.get, h.set, true);
    expect(h.state().cards.map((c) => c.id)).toEqual(["mc_1"]);
    expect(warn.mock.calls.flat().join(" ")).toContain("w_broken");
    expect(h.state().cardPrefs.migratedAt, "neither marker advances").toBeNull();

    // Neither marker advanced, so a later boot converts a record added since.
    vi.clearAllMocks();
    h.set({ mindCards: [sourceCard(), sourceCard({ id: "mc_2", title: "Second-order" })] });
    await runDataMigrations(h.get, h.set, true);
    expect(h.state().cards.map((c) => c.id)).toEqual(["mc_1", "mc_2"]);
    expect(saveBulkPut).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });

  it("names any card whose review schedule the conversion ended", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const h = cardsHarness("u-cards-11", {
      mindCards: [
        sourceCard({
          id: "mc_prompt",
          type: "prompt",
          flippable: true,
          box: 2,
          lastReviewed: "2026-06-05",
          nextDue: "2026-06-07",
        }),
      ],
      vocab: [],
    });
    await runDataMigrations(h.get, h.set, true);

    expect(h.state().cards[0]).toMatchObject({ box: null, nextDue: null });
    expect(warn.mock.calls.flat().join(" ")).toContain("mc_prompt");
    expect(
      h.state().cardPrefs.migratedAt,
      "an ended schedule is reported, not a failure",
    ).not.toBeNull();
    warn.mockRestore();
  });

  it("carries the source's own stamps into the local row", async () => {
    const h = cardsHarness("u-cards-4", { vocab: [] });
    await runDataMigrations(h.get, h.set, true);
    expect(h.state().cards[0].updatedAt).toBe("2026-06-02T09:00:00.000Z");
  });

  it("inverts the disabled-category rows into the include list", async () => {
    const h = cardsHarness("u-cards-5", {
      mindCards: [sourceCard({ category: "mental models" })],
      mindMeta: [
        {
          id: "category:mental models",
          kind: "category",
          key: "mental models",
          value: false,
          setAt: "2026-06-03T08:00:00.000Z",
          updatedAt: "",
          fieldUpdatedAt: {},
        },
      ],
    });
    await runDataMigrations(h.get, h.set, true);
    expect(h.state().cardPrefs.categories).toEqual(["Language"]);
    expect(savePut).toHaveBeenCalledWith("cardPrefs", h.state().cardPrefs);
  });

  it("hands the batch write insert rollbacks so a rejection cannot fake a completion", async () => {
    vi.mocked(saveBulkPut).mockResolvedValueOnce({
      landedRows: 0,
      writtenChunks: 0,
      failedChunk: 0,
      result: null,
    });
    const h = cardsHarness("u-cards-6");
    await runDataMigrations(h.get, h.set, true);
    expect(vi.mocked(saveBulkPut).mock.calls[0][2]).toEqual([
      { kind: "insert" },
      { kind: "insert" },
    ]);
    expect(h.state().cardPrefs.migratedAt, "a lost batch must not stamp").toBeNull();

    // The rejection left both markers unwritten, so the next boot writes again.
    vi.clearAllMocks();
    h.set({ cards: [] }); // saveBulkPut's rollback does this through the real store
    await runDataMigrations(h.get, h.set, true);
    expect(saveBulkPut).toHaveBeenCalledTimes(1);
  });
});
