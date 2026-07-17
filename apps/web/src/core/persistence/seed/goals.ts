import { addDays } from "date-fns";
import type { Goal } from "@/features/goals/model";
import type { SeedContext } from "./context";

export function buildGoals(ctx: SeedContext): Goal[] {
  const { weekStart, iso, yearStart, yearEnd } = ctx;
  return [
    {
      id: "g1",
      valueId: "v1",
      name: "Get a higher-paying job",
      icon: "briefcase",
      status: "active",
      start: iso(addDays(weekStart, -7)),
      end: iso(addDays(weekStart, 35)),
      progress: 0.42,
      order: 0,
      subgoals: [
        { id: "s1", name: "Rewrite résumé + portfolio", done: true },
        { id: "s2", name: "Reach out to 10 people", done: true },
        { id: "s3", name: "Apply to 15 roles", done: false },
        { id: "s4", name: "Land 3 final-round interviews", done: false },
      ],
    },
    {
      id: "g2",
      valueId: "v2",
      name: "Read 24 books this year",
      icon: "book",
      status: "active",
      start: yearStart,
      end: yearEnd,
      progress: 0.46,
      order: 1,
      subgoals: [
        { id: "s5", name: "Build a nightly reading habit", done: true },
        { id: "s6", name: "Finish the current stack of 4", done: false },
      ],
    },
    {
      id: "g3",
      valueId: "v3",
      name: "Sleep 7.5h consistently",
      icon: "heart",
      status: "paused",
      start: iso(addDays(weekStart, -28)),
      end: iso(addDays(weekStart, 21)),
      progress: 0.61,
      order: 2,
      subgoals: [
        { id: "s7", name: "Fixed wind-down at 10:30", done: true },
        { id: "s8", name: "No screens in bed", done: false },
      ],
    },
    {
      id: "g4",
      valueId: "v5",
      name: "Run a 10k",
      icon: "zap",
      status: "active",
      start: iso(addDays(weekStart, -14)),
      end: iso(addDays(weekStart, 56)),
      progress: 0.3,
      order: 3,
      subgoals: [
        { id: "s9", name: "Couch-to-5k finished", done: true },
        { id: "s10", name: "Hold 5k under 30 min", done: false },
        { id: "s11", name: "First parkrun", done: false },
      ],
    },
  ];
}
