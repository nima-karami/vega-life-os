import { todayISO } from "@/core/lib/date";
import type { IconName } from "@/core/lib/icon-names";
import type { Habit, HabitSchedule } from "./model";
import type { RepeatMode } from "./RepeatPicker";
import { getHabitSchedule } from "./recurrence";

export interface Draft {
  name: string;
  valueId: string;
  goalId: string | null;
  icon: IconName;
  /** "HH:mm" or null for an anytime (untimed) habit */
  time: string | null;
  days: number[];
  durationMin: number;
  repeat: RepeatMode;
  interval: number;
  anchor: string;
  daysOfMonth: number[];
  lastDay: boolean;
}

export function buildDraftFromHabit(habit: Habit): Draft {
  const schedule = getHabitSchedule(habit);
  const isMonthly = schedule.type === "monthly";
  return {
    name: habit.name,
    valueId: habit.valueId,
    goalId: habit.goalId,
    icon: habit.icon,
    time: habit.time,
    days: schedule.type === "weekly" ? [...schedule.days] : [1, 1, 1, 1, 1, 1, 1],
    durationMin: habit.durationMin,
    repeat: isMonthly ? "monthly" : schedule.interval > 1 ? "nweekly" : "weekly",
    interval: schedule.type === "weekly" && schedule.interval > 1 ? schedule.interval : 2,
    anchor: schedule.type === "weekly" ? schedule.anchor : todayISO(),
    daysOfMonth: isMonthly ? [...schedule.daysOfMonth] : [new Date().getDate()],
    lastDay: isMonthly ? schedule.lastDay : false,
  };
}

export function createBlankDraft(valueId: string): Draft {
  return {
    name: "",
    valueId,
    goalId: null,
    icon: "repeat",
    time: "09:00",
    days: [1, 1, 1, 1, 1, 1, 1],
    durationMin: 30,
    repeat: "weekly",
    interval: 2,
    anchor: todayISO(),
    daysOfMonth: [new Date().getDate()],
    lastDay: false,
  };
}

export function buildSchedule(d: Draft): HabitSchedule {
  if (d.repeat === "monthly") {
    return { type: "monthly", daysOfMonth: d.daysOfMonth, lastDay: d.lastDay };
  }
  return {
    type: "weekly",
    days: d.days,
    interval: d.repeat === "nweekly" ? d.interval : 1,
    anchor: d.anchor,
  };
}
