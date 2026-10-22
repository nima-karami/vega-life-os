import { todayISO } from "@/core/lib/date";
import { fillDefaults } from "@/core/lib/defaults";
import { uid } from "@/core/lib/id";
import type { Value } from "@/features/values/model";
import { splitValuesBySeason } from "@/features/values/selectors";
import type { Habit } from "./model";

/** A new habit's value: the first in-season one, else any live one, else none. */
export function pickDefaultValueId(values: Value[]): string {
  return splitValuesBySeason(values).inSeason[0]?.id ?? values[0]?.id ?? "";
}

export function buildHabit(patch: Partial<Habit>, values: Value[]): Habit {
  const createdAt = patch.createdAt ?? todayISO();
  const habit = fillDefaults<Habit>(patch, {
    id: uid("h_"),
    name: "New habit",
    goalId: null,
    valueId: patch.valueId ?? pickDefaultValueId(values),
    icon: "repeat",
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
