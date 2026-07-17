import { addDays } from "date-fns";
import type { Habit } from "@/features/habits/model";
import { isActiveOn } from "@/features/habits/recurrence";
import type { Task, TaskStatus } from "@/features/tasks/model";
import type { SeedContext } from "./context";

// morning-ish tasks (time < 14:00) on `today` count as done; later ones todo
function statusForDate(
  dateStr: string,
  time: string | null,
  today: string,
  rng: () => number,
): TaskStatus {
  if (dateStr < today) {
    const r = rng();
    if (r < 0.12) return "skip";
    if (r < 0.2) return "todo"; // a few honest misses
    return "done";
  }
  if (dateStr === today) {
    if (!time) return "todo"; // anytime habit: leave today's unchecked so it can be ticked
    const hour = parseInt(time.slice(0, 2), 10);
    return hour < 14 ? "done" : "todo";
  }
  return "todo";
}

/** Habit instances across ~12 weeks of history + the current week, plus the
 *  scheduled one-off tasks. Advances the shared id/order counter on `ctx`. */
export function buildTasks(ctx: SeedContext, habits: Habit[]): Task[] {
  const { weekStart, iso, dayISO, rng, today } = ctx;
  const tid = ctx.nextId;
  const tasks: Task[] = [];

  // generate ~12 weeks of history + the current week (drives streaks/analytics/heatmap)
  const FROM = -84;
  const TO = 6;
  for (const h of habits) {
    for (let off = FROM; off <= TO; off++) {
      const dateStr = iso(addDays(weekStart, off));
      if (!isActiveOn(h, dateStr)) continue;
      const status = statusForDate(dateStr, h.time, today, rng);
      tasks.push({
        id: tid(),
        title: h.name,
        kind: "habit",
        habitId: h.id,
        goalId: h.goalId,
        valueId: h.valueId,
        date: dateStr,
        time: h.time,
        durationMin: h.durationMin,
        status,
        detached: false,
        note: "",
        order: ctx.counter.order,
      });
    }
  }

  // a detached habit instance (moved earlier + note) — Wed reading
  const wedRead = tasks.find((t) => t.habitId === "h1" && t.date === dayISO(2));
  if (wedRead) {
    wedRead.title = "Read — finish 'Sapiens' ch.9";
    wedRead.time = "20:00";
    wedRead.detached = true;
    wedRead.note = "Moved earlier — dinner plans. Reading Sapiens, not the new stack.";
  }
  // a meaningful note on a done apply
  const monApply = tasks.find((t) => t.habitId === "h2" && t.date === dayISO(0));
  if (monApply) monApply.note = "Sent to Northwind — analyst role.";

  // one-off scheduled tasks
  tasks.push({
    id: tid(),
    title: "Update ID card",
    kind: "oneoff",
    habitId: null,
    goalId: null,
    valueId: "v4",
    date: dayISO(3),
    time: "13:00",
    durationMin: 60,
    status: "todo",
    detached: false,
    note: "Photo + form at city office. Bring old card.",
    order: ctx.counter.order,
  });
  tasks.push({
    id: tid(),
    title: "Mock interview w/ Dana",
    kind: "oneoff",
    habitId: null,
    goalId: "g1",
    valueId: "v1",
    date: dayISO(4),
    time: "16:00",
    durationMin: 60,
    status: "todo",
    detached: false,
    note: "",
    order: ctx.counter.order,
  });
  // an all-day (dated, untimed) one-off — sits in the calendar's all-day row,
  // draggable onto the grid or schedulable via its menu
  tasks.push({
    id: tid(),
    title: "Pick up dry cleaning",
    kind: "oneoff",
    habitId: null,
    goalId: null,
    valueId: "v4",
    date: dayISO(1),
    time: null,
    durationMin: 60,
    status: "todo",
    detached: false,
    note: "Ready after 4pm.",
    order: ctx.counter.order,
  });

  return tasks;
}
