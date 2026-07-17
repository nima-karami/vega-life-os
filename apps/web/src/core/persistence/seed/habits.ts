import { addDays } from "date-fns";
import type { Habit, HabitSchedule } from "@/features/habits/model";
import { iso } from "./helpers";

export function buildHabits(weekStart: Date): Habit[] {
  const createdAt = iso(addDays(weekStart, -60));
  // weekly schedule from a Mon..Sun mask (interval 1; anchor irrelevant at interval 1)
  const wk = (days: number[]): HabitSchedule => ({
    type: "weekly",
    days,
    interval: 1,
    anchor: createdAt.slice(0, 10),
  });
  return (
    [
      {
        id: "h1",
        name: "Read 1h before bed",
        goalId: "g2",
        valueId: "v2",
        icon: "book",
        time: "21:30",
        schedule: wk([1, 1, 1, 1, 1, 1, 1]),
        durationMin: 60,
        createdAt,
      },
      {
        id: "h2",
        name: "Apply to 1 role",
        goalId: "g1",
        valueId: "v1",
        icon: "briefcase",
        time: "09:00",
        schedule: wk([1, 1, 1, 1, 1, 0, 0]),
        durationMin: 45,
        createdAt,
      },
      {
        id: "h3",
        name: "Lights out by 22:30",
        goalId: "g3",
        valueId: "v3",
        icon: "heart",
        time: "22:30",
        schedule: wk([1, 1, 1, 1, 1, 1, 1]),
        durationMin: 30,
        createdAt,
      },
      {
        id: "h4",
        name: "Morning walk",
        goalId: null,
        valueId: "v5",
        icon: "zap",
        time: "07:30",
        schedule: wk([1, 0, 1, 0, 1, 0, 0]),
        durationMin: 45,
        createdAt,
      },
      {
        id: "h5",
        name: "Pay the bills",
        goalId: null,
        valueId: "v4",
        icon: "card",
        time: "10:00",
        schedule: { type: "monthly", daysOfMonth: [1], lastDay: false },
        durationMin: 45,
        createdAt,
      },
      {
        id: "h6",
        name: "Tidy 15 min",
        goalId: null,
        valueId: "v3",
        icon: "heart",
        time: "18:30",
        schedule: wk([1, 1, 1, 1, 1, 1, 1]),
        durationMin: 15,
        createdAt,
      },
      {
        id: "h7",
        name: "Call family",
        goalId: null,
        valueId: "v2",
        icon: "eye",
        time: "19:00",
        schedule: wk([0, 0, 0, 0, 0, 0, 1]),
        durationMin: 40,
        createdAt,
      },
      {
        id: "h8",
        name: "Workout 30 min",
        goalId: "g4",
        valueId: "v5",
        icon: "zap",
        time: "18:00",
        schedule: wk([0, 1, 0, 1, 0, 1, 0]),
        durationMin: 30,
        createdAt,
      },
      {
        // an "anytime" habit — no time; tracked in Today's Daily-habits strip, off the calendar
        id: "h9",
        name: "Drink water",
        goalId: null,
        valueId: "v3",
        icon: "spark",
        time: null,
        schedule: wk([1, 1, 1, 1, 1, 1, 1]),
        durationMin: 5,
        createdAt,
      },
    ] as Omit<Habit, "archivedAt">[]
  ).map((h) => ({ ...h, archivedAt: null }));
}
