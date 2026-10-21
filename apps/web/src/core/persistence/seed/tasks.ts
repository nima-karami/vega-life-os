import { addDays } from "date-fns";
import type { Habit } from "@/features/habits/model";
import { isActiveOn } from "@/features/habits/recurrence";
import type { Task, TaskStatus } from "@/features/tasks/model";
import { iso, mulberry32 } from "./helpers";

export function buildTasks(habits: Habit[], ref: Date, weekStart: Date): Task[] {
  const rng = mulberry32(0x7e6a17);
  const dayISO = (i: number) => iso(addDays(weekStart, i));

  const tasks: Task[] = [];
  let order = 0;
  const tid = () => `t${String(++order).padStart(3, "0")}`;

  // morning-ish tasks (time < 14:00) on `today` count as done; later ones todo
  const today = iso(ref);
  const statusForDate = (dateStr: string, time: string | null): TaskStatus => {
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
  };

  // generate ~12 weeks of history + the current week (drives analytics/heatmap)
  const FROM = -84;
  const TO = 6;
  for (const h of habits) {
    for (let off = FROM; off <= TO; off++) {
      const dateStr = iso(addDays(weekStart, off));
      if (!isActiveOn(h, dateStr)) continue;
      const status = statusForDate(dateStr, h.time);
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
        order,
      });
    }
  }

  // a detached habit instance (moved earlier + note) — Wed reading
  const wedRead = tasks.find((t) => t.habitId === "h1" && t.date === dayISO(2));
  if (wedRead) {
    wedRead.title = "Read: finish 'Sapiens' ch.9";
    wedRead.time = "20:00";
    wedRead.detached = true;
    wedRead.note = "Moved earlier for dinner plans. Reading Sapiens, not the new stack.";
  }
  // a meaningful note on a done apply
  const monApply = tasks.find((t) => t.habitId === "h2" && t.date === dayISO(0));
  if (monApply) monApply.note = "Sent to Northwind for the analyst role.";

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
    order,
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
    order,
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
    order,
  });

  // undated one-off backlog
  const backlog: Task[] = [
    {
      id: tid(),
      title: "Renew passport",
      kind: "oneoff",
      habitId: null,
      goalId: null,
      valueId: "v4",
      date: null,
      time: null,
      durationMin: 60,
      status: "open",
      detached: false,
      note: "",
      order,
    },
    {
      id: tid(),
      title: "Negotiation prep doc",
      kind: "oneoff",
      habitId: null,
      goalId: "g1",
      valueId: "v1",
      date: null,
      time: null,
      durationMin: 90,
      status: "open",
      detached: false,
      note: "Salary research + scripts.",
      order,
    },
    {
      id: tid(),
      title: "Set up reading nook",
      kind: "oneoff",
      habitId: null,
      goalId: "g2",
      valueId: "v2",
      date: null,
      time: null,
      durationMin: 60,
      status: "open",
      detached: false,
      note: "",
      order,
    },
    {
      id: tid(),
      title: "Buy blackout curtains",
      kind: "oneoff",
      habitId: null,
      goalId: "g3",
      valueId: "v3",
      date: null,
      time: null,
      durationMin: 30,
      status: "open",
      detached: false,
      note: "",
      order,
    },
    {
      id: tid(),
      title: "Sort out tax documents",
      kind: "oneoff",
      habitId: null,
      goalId: null,
      valueId: "v4",
      date: null,
      time: null,
      durationMin: 90,
      status: "open",
      detached: false,
      note: "No deadline yet.",
      order,
    },
    {
      id: tid(),
      title: "Plan a long weekend trip",
      kind: "oneoff",
      habitId: null,
      goalId: null,
      valueId: "v5",
      date: null,
      time: null,
      durationMin: 60,
      status: "open",
      detached: false,
      note: "",
      order,
    },
  ];
  tasks.push(...backlog);

  // energy lens (charge / drain) by activity — what lifts vs. costs you
  const ENERGY_BY_TITLE: Record<string, "charge" | "drain" | "neutral"> = {
    "Read 1h before bed": "charge",
    "Read: finish 'Sapiens' ch.9": "charge",
    "Apply to 1 role": "drain",
    "Lights out by 22:30": "neutral",
    "Morning walk": "charge",
    "Workout 30 min": "charge",
    "Pay the bills": "drain",
    "Tidy 15 min": "neutral",
    "Call family": "charge",
    "Update ID card": "drain",
    "Mock interview w/ Dana": "drain",
    "Negotiation prep doc": "drain",
    "Sort out tax documents": "drain",
    "Renew passport": "drain",
    "Set up reading nook": "charge",
    "Buy blackout curtains": "neutral",
    "Plan a long weekend trip": "charge",
  };
  for (const t of tasks) {
    t.energy = ENERGY_BY_TITLE[t.title] ?? "neutral";
  }

  return tasks;
}
