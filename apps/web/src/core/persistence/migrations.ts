import { todayISO } from "@/core/lib/date";
import { savePut, saveRemove } from "@/core/store/persist";
import type { Habit } from "@/features/habits/model";
import { isActiveOn, normalizeHabit } from "@/features/habits/recurrence";
import type { Task } from "@/features/tasks/model";
import { RETIRED_HUE_REPLACEMENT } from "@/features/values/color";
import type { Value } from "@/features/values/model";

/** Bumped whenever a one-time data migration must run.
 *  v1: consolidate habit cadence onto `schedule` (strip legacy `days`/`recurrence`)
 *      and prune habit instances that no longer match their schedule.
 *  v2: backfill `slotDate` (= date) and `completedAt` (= slot day for existing dones,
 *      treated as on-time) onto tasks, and dedupe any same habitId@slotDate.
 *  v3: move values off the two hues retired when the card became the colour
 *      (slate/ink) onto their nearest surviving neighbour. */
export const DATA_VERSION = 3;

interface MigrationState {
  authUid: string | null;
  habits: Habit[];
  tasks: Task[];
  values: Value[];
}

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

/** One-time, idempotent, version-gated migration for the active dataset. Persists
 *  the normalized habits (stripping legacy fields from storage), prunes stale
 *  instances, and syncs in-memory state. A no-op once the marker is current. */
export function runDataMigrations(
  get: () => MigrationState,
  set: (patch: { habits: Habit[]; tasks?: Task[]; values?: Value[] }) => void,
): void {
  const uid = get().authUid;
  if (readDataVersion(uid) >= DATA_VERSION) return;

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

  writeDataVersion(uid, DATA_VERSION);
}
