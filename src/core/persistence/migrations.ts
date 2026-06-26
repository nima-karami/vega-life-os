import { todayISO } from "@/core/lib/date";
import { savePut, saveRemove } from "@/core/store/persist";
import type { Habit } from "@/features/habits/model";
import { isActiveOn, normalizeHabit } from "@/features/habits/recurrence";
import type { Task } from "@/features/tasks/model";

/** Bumped whenever a one-time data migration must run. v1: consolidate habit
 *  cadence onto `schedule` (strip legacy `days`/`recurrence`) and prune habit
 *  instances that no longer match their schedule. */
export const DATA_VERSION = 1;

interface MigrationState {
  authUid: string | null;
  habits: Habit[];
  tasks: Task[];
}

/** Pure migration: normalize habits to the consolidated shape and find the
 *  future, undone, non-detached habit instances that no longer match. */
export function migrateData(snapshot: { habits: Habit[]; tasks: Task[] }): {
  habits: Habit[];
  prunedTaskIds: string[];
} {
  const habits = snapshot.habits.map(normalizeHabit);
  const today = todayISO();
  const habitById = new Map(habits.map((h) => [h.id, h]));
  const prunedTaskIds = snapshot.tasks
    .filter(
      (t) =>
        t.habitId != null &&
        t.date != null &&
        t.date >= today &&
        t.status === "todo" &&
        !t.detached &&
        habitById.has(t.habitId) &&
        !isActiveOn(habitById.get(t.habitId) as Habit, t.date),
    )
    .map((t) => t.id);
  return { habits, prunedTaskIds };
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
  set: (patch: { habits: Habit[]; tasks?: Task[] }) => void,
): void {
  const uid = get().authUid;
  if (readDataVersion(uid) >= DATA_VERSION) return;

  const { habits, prunedTaskIds } = migrateData({ habits: get().habits, tasks: get().tasks });
  for (const h of habits) savePut("habits", h);

  if (prunedTaskIds.length) {
    const drop = new Set(prunedTaskIds);
    set({ habits, tasks: get().tasks.filter((t) => !drop.has(t.id)) });
    for (const id of prunedTaskIds) saveRemove("tasks", id);
  } else {
    set({ habits });
  }

  writeDataVersion(uid, DATA_VERSION);
}
