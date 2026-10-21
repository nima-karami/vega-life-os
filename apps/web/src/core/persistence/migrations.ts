import type { Card, CardPrefs, MindCard, MindMetaRecord } from "@vega/shared";
import { todayISO } from "@/core/lib/date";
import { saveBulkPut, savePut, saveRemove } from "@/core/store/persist";
import type { Habit } from "@/features/habits/model";
import { isActiveOn, normalizeHabit } from "@/features/habits/recurrence";
import type { VocabEntry } from "@/features/library/model";
import type { Task } from "@/features/tasks/model";
import { RETIRED_HUE_REPLACEMENT } from "@/features/values/color";
import type { Value } from "@/features/values/model";
import type { Dataset } from "./adapter";
import { migrateToCards } from "./card-migration";

/** Bumped whenever a one-time data migration must run.
 *  v1: consolidate habit cadence onto `schedule` (strip legacy `days`/`recurrence`)
 *      and prune habit instances that no longer match their schedule.
 *  v2: backfill `slotDate` (= date) and `completedAt` (= slot day for existing dones,
 *      treated as on-time) onto tasks, and dedupe any same habitId@slotDate.
 *  v3: move values off the two hues retired when the card became the colour
 *      (slate/ink) onto their nearest surviving neighbour.
 *  v4: fold mindCards, mindMeta and vocab into the one `cards` collection. Guarded by the
 *      synced cardPrefs.migratedAt stamp as well as this marker — this one is per-profile. */
export const DATA_VERSION = 4;

/** v1–v3 stamp their own marker, so an incomplete v4 pass cannot make them re-run every boot. */
const ENTITY_VERSION = 3;

interface MigrationState {
  authUid: string | null;
  habits: Habit[];
  tasks: Task[];
  values: Value[];
  cards: Card[];
  cardPrefs: CardPrefs;
  mindCards: MindCard[];
  mindMeta: MindMetaRecord[];
  vocab: VocabEntry[];
  pushToast: (message: string) => void;
}

type MigrationPatch = {
  habits?: Habit[];
  tasks?: Task[];
  values?: Value[];
  cards?: Card[];
  cardPrefs?: CardPrefs;
};

/** Rank for picking the survivor among duplicate-slot instances: a resolved
 *  (done/skip) instance beats an un-moved (date===slotDate) one, which beats the rest. */
const dedupeRank = (t: Task) =>
  t.status === "done" || t.status === "skip" ? 2 : t.slotDate === t.date ? 1 : 0;

/** Pure migration: normalize habits, backfill the slot/completion fields on tasks,
 *  move values off retired hues, and collect ids to drop — both schedule mismatches
 *  and duplicate slots. */
export function migrateData(snapshot: { habits: Habit[]; tasks: Task[]; values: Value[] }): {
  habits: Habit[];
  tasks: Task[];
  values: Value[];
  rehuedValueIds: string[];
  prunedTaskIds: string[];
} {
  const habits = snapshot.habits.map(normalizeHabit);
  const today = todayISO();
  const habitById = new Map(habits.map((h) => [h.id, h]));

  const tasks = snapshot.tasks.map((t) => ({
    ...t,
    slotDate: t.slotDate ?? (t.habitId ? t.date : null),
    // historical completions have no recorded time → treat them as on-time
    completedAt: t.completedAt ?? (t.status === "done" ? (t.date ?? t.slotDate ?? today) : null),
  }));

  // Dedupe duplicate habitId@slotDate (best survivor wins; earliest breaks a tie).
  const best = new Map<string, Task>();
  const dupIds: string[] = [];
  for (const t of tasks) {
    if (t.habitId == null || t.slotDate == null) continue;
    const key = `${t.habitId}@${t.slotDate}`;
    const prev = best.get(key);
    if (!prev) best.set(key, t);
    else if (dedupeRank(t) > dedupeRank(prev)) {
      dupIds.push(prev.id);
      best.set(key, t);
    } else dupIds.push(t.id);
  }

  // Future, undone, non-detached instances whose slot no longer matches the schedule.
  const prunedSchedule = tasks
    .filter((t) => {
      const slot = t.slotDate ?? t.date;
      return (
        t.habitId != null &&
        slot != null &&
        slot >= today &&
        t.status === "todo" &&
        !t.detached &&
        habitById.has(t.habitId) &&
        !isActiveOn(habitById.get(t.habitId) as Habit, slot)
      );
    })
    .map((t) => t.id);

  const rehuedValueIds: string[] = [];
  const values = snapshot.values.map((v) => {
    const replacement = v.hue ? RETIRED_HUE_REPLACEMENT[v.hue.toLowerCase()] : undefined;
    if (!replacement) return v;
    rehuedValueIds.push(v.id);
    return { ...v, hue: replacement };
  });

  const prunedTaskIds = [...new Set([...dupIds, ...prunedSchedule])];
  return { habits, tasks, values, rehuedValueIds, prunedTaskIds };
}

// Per-dataset version marker. Persisted in localStorage when available (browser);
// an in-memory fallback keeps node/test runs deterministic.
const memVersions = new Map<string, number>();
const markerKey = (uid: string | null) => `vega:dataVersion:${uid ?? "local"}`;

function readDataVersion(uid: string | null): number {
  const key = markerKey(uid);
  if (typeof localStorage !== "undefined") return Number(localStorage.getItem(key) ?? 0);
  return memVersions.get(key) ?? 0;
}

function writeDataVersion(uid: string | null, v: number): void {
  const key = markerKey(uid);
  if (typeof localStorage !== "undefined") localStorage.setItem(key, String(v));
  else memVersions.set(key, v);
}

/** The pass reads three retired collections and guards on two new ones. A load missing any
 *  of the five is not a migratable state — a guard cannot read a collection that never
 *  arrived, and an unguarded pass resurrects deleted cards — so the marker must not advance. */
export function hasMigrationSources(dataset: Partial<Dataset>): boolean {
  return (
    Array.isArray(dataset.cards) &&
    Array.isArray(dataset.cardPrefs) &&
    Array.isArray(dataset.mindCards) &&
    Array.isArray(dataset.mindMeta) &&
    Array.isArray(dataset.vocab)
  );
}

function runEntityMigrations(
  get: () => MigrationState,
  set: (patch: MigrationPatch) => void,
): void {
  const { habits, tasks, values, rehuedValueIds, prunedTaskIds } = migrateData({
    habits: get().habits,
    tasks: get().tasks,
    values: get().values,
  });
  for (const h of habits) savePut("habits", h);

  const rehued = new Set(rehuedValueIds);
  for (const v of values) if (rehued.has(v.id)) savePut("values", v);

  const drop = new Set(prunedTaskIds);
  const nextTasks = tasks.filter((t) => !drop.has(t.id));
  set({ habits, tasks: nextTasks, values });
  for (const t of nextTasks) savePut("tasks", t); // persist backfilled slotDate/completedAt
  for (const id of prunedTaskIds) saveRemove("tasks", id);
}

const isUnfiltered = (prefs: CardPrefs): boolean =>
  prefs.types.length === 0 && prefs.categories.length === 0;

async function runCardsMigration(
  get: () => MigrationState,
  set: (patch: MigrationPatch) => void,
  sourcesLoaded: boolean,
): Promise<"complete" | "deferred" | "incomplete"> {
  if (!sourcesLoaded) return "deferred";

  // Guard 1, the normative one: another device already converted this account. Converting again
  // would re-create every card deleted since — there are no card tombstones (spec §6).
  if (get().cardPrefs.migratedAt !== null) return "complete";

  const { cards, prefs, skipped, endedSchedules } = migrateToCards({
    mindCards: get().mindCards,
    mindMeta: get().mindMeta,
    vocab: get().vocab,
  });

  // Guard 2: the mappers are deterministic, so an id already present was written by an
  // earlier pass of this same code. This is what makes a half-run safe to retry.
  const present = new Set(get().cards.map((card) => card.id));
  const pending = cards.filter((card) => !present.has(card.id));
  if (pending.length > 0) {
    set({ cards: [...get().cards, ...pending] });
    // Insert rollbacks: a rejected batch must take its rows back out of the store, or the next
    // pass reads them as already migrated and completes a migration that never landed.
    const outcome = await saveBulkPut(
      "cards",
      pending,
      pending.map(() => ({ kind: "insert" as const })),
    );
    if (outcome.result === null) return "incomplete";
  }

  if (endedSchedules.length > 0)
    console.warn(
      `[migration v4] ended the review schedule of ${endedSchedules.length} card(s): ${endedSchedules.join(", ")}`,
    );

  if (skipped.length > 0) {
    console.warn(`[migration v4] skipped ${skipped.length} record(s): ${skipped.join(", ")}`);
    return "incomplete";
  }

  // The stamp is the guard, so a completing pass always writes it — even one that converted
  // nothing. mode and view are the user's; the inverted lists only fill an untouched record.
  const current = get().cardPrefs;
  const stamped: CardPrefs = {
    ...current,
    ...(isUnfiltered(current) ? { types: prefs.types, categories: prefs.categories } : {}),
    migratedAt: new Date().toISOString(),
  };
  set({ cardPrefs: stamped });
  savePut("cardPrefs", stamped);

  if (pending.length > 0)
    get().pushToast("Card bodies are now plain text. The earlier versions are kept");
  return "complete";
}

/** One-time, idempotent, version-gated migration for the active dataset. */
export async function runDataMigrations(
  get: () => MigrationState,
  set: (patch: MigrationPatch) => void,
  sourcesLoaded: boolean,
): Promise<void> {
  const uid = get().authUid;
  const version = readDataVersion(uid);
  if (version >= DATA_VERSION) return;

  if (version < ENTITY_VERSION) {
    runEntityMigrations(get, set);
    writeDataVersion(uid, ENTITY_VERSION);
  }

  if ((await runCardsMigration(get, set, sourcesLoaded)) === "complete")
    writeDataVersion(uid, DATA_VERSION);
}
