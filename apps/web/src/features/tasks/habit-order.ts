import type { Orderable } from "@/core/lib/reorder";
import type { Task } from "./model";
import { isAnytimeHabit } from "./selectors";

/** Each day's sorted slots, nudged apart so tied orders can still express a sequence. */
function spreadSlots(orders: number[]): number[] {
  const slots: number[] = [];
  for (const order of orders) slots.push(Math.max(order, (slots.at(-1) ?? order - 1) + 1));
  return slots;
}

function resequenceDay(instances: Task[], rank: Map<string, number>): Orderable[] {
  const bySlot = [...instances].sort((a, b) => a.order - b.order);
  const slots = spreadSlots(bySlot.map((t) => t.order));
  const byRank = [...bySlot].sort(
    (a, b) => (rank.get(a.habitId ?? "") ?? 0) - (rank.get(b.habitId ?? "") ?? 0),
  );
  return byRank.flatMap((t, index) =>
    t.order === slots[index] ? [] : [{ id: t.id, order: slots[index] }],
  );
}

/**
 * The Anytime instances of `habitSequence`'s habits after `date`, re-sequenced day by day to
 * follow it. Each day reuses its own order slots, so tasks outside the set keep their places.
 */
export function carryHabitOrderForward(
  tasks: Task[],
  date: string,
  habitSequence: string[],
): Orderable[] {
  const rank = new Map<string, number>();
  for (const habitId of habitSequence) if (!rank.has(habitId)) rank.set(habitId, rank.size);
  const laterByDay = new Map<string, Task[]>();
  for (const t of tasks) {
    if (t.date === null || t.date <= date || !isAnytimeHabit(t) || !rank.has(t.habitId ?? ""))
      continue;
    laterByDay.set(t.date, [...(laterByDay.get(t.date) ?? []), t]);
  }
  return [...laterByDay.keys()]
    .sort()
    .flatMap((day) => resequenceDay(laterByDay.get(day) ?? [], rank));
}

/** Each habit's order on its latest-dated instance, which a newly generated one inherits. */
export function findLatestHabitOrders(tasks: Task[]): Map<string, number> {
  const latest = new Map<string, Task>();
  for (const t of tasks) {
    if (t.habitId == null || t.date === null) continue;
    const current = latest.get(t.habitId);
    if (current?.date == null || t.date > current.date) latest.set(t.habitId, t);
  }
  return new Map([...latest].map(([habitId, t]) => [habitId, t.order]));
}
