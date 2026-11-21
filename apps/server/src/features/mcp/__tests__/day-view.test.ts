import { partitionToday, type TaskCreate } from "@vega/shared";
import { expect, it } from "vitest";
import { buildDayView } from "../day-view";

const date = "2026-11-20";
const task: TaskCreate = {
  id: "scheduled",
  title: "Walk",
  date,
  time: "12:00",
  status: "todo",
  kind: "oneoff",
  habitId: null,
  valueId: null,
  goalId: null,
  durationMin: 20,
  order: 0,
  note: "",
  detached: false,
  completedAt: null,
};

it("uses the shared Today buckets, including anytime and resolved tasks", () => {
  const tasks: TaskCreate[] = [
    task,
    { ...task, id: "done", status: "skip" },
    { ...task, id: "anytime", kind: "habit", habitId: "h_walk", time: null },
    { ...task, id: "other", date: "2026-11-21" },
  ];
  expect(buildDayView(date, tasks, [], null).tasks).toEqual(partitionToday(tasks, date));
});
