import type { Habit } from "../entities/habit";
import type { WireRow } from "../sync";
import { todayISO } from "./date";
import { fillDefaults } from "./defaults";
import { uid } from "./id";
export type HabitShape<Icon extends string = string> = Omit<
  WireRow<Habit>,
  "updatedAt" | "icon"
> & { icon: Icon };
export function buildHabit<Icon extends string>(
  patch: Partial<HabitShape<Icon>>,
  defaults: { valueId: string; icon: Icon },
  today = todayISO(),
  makeId = uid,
): HabitShape<Icon> {
  const createdAt = patch.createdAt ?? today;
  const habit = fillDefaults<HabitShape<Icon>>(patch, {
    id: makeId("h_"),
    name: "New habit",
    goalId: null,
    valueId: patch.valueId ?? defaults.valueId,
    icon: defaults.icon,
    time: "09:00",
    durationMin: 30,
    createdAt,
    archivedAt: null,
    pausedAt: null,
    resumedAt: null,
    pausedSpans: [],
    tracked: false,
    plan: "",
    schedule: {
      type: "weekly",
      days: [1, 1, 1, 1, 1, 1, 1],
      interval: 1,
      anchor: createdAt.slice(0, 10),
    },
  });
  // an explicit null time means anytime; only an omitted time defaults
  return patch.time === undefined ? habit : { ...habit, time: patch.time };
}
