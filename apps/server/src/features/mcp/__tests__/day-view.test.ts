import type { CalendarEventCreate, TaskCreate } from "@vega/shared";
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
  const buckets = buildDayView(date, tasks, [], null).tasks;
  expect(buckets.remaining.map((row) => row.id)).toEqual(["scheduled"]);
  expect(buckets.done.map((row) => row.id)).toEqual(["done"]);
  expect(buckets.anytime.map((row) => row.id)).toEqual(["anytime"]);
  expect(buckets.anytimeDone).toEqual([]);
});

const event: CalendarEventCreate = {
  id: "ce_a",
  googleId: "g_a",
  iCalUID: "u_a",
  calendarId: "cal",
  title: "Standup",
  date,
  endDate: null,
  time: "09:00",
  durationMin: 30,
  allDay: false,
  recurringEventId: null,
  googleUpdated: null,
  status: "confirmed",
  responseStatus: "accepted",
  valueId: null,
  goalId: null,
  note: "",
  vegaEditedAt: null,
  pendingDelete: false,
  removedAt: null,
};

it("shows the day's events the way the Today page does", () => {
  const events: CalendarEventCreate[] = [
    event,
    { ...event, id: "ce_dup", calendarId: "cal_2" },
    { ...event, id: "ce_declined", iCalUID: "u_b", responseStatus: "declined" },
    { ...event, id: "ce_removed", iCalUID: "u_c", removedAt: "2026-11-19T00:00:00Z" },
    {
      ...event,
      id: "ce_span",
      iCalUID: "u_d",
      date: "2026-11-19",
      endDate: "2026-11-21",
      time: null,
      allDay: true,
    },
    { ...event, id: "ce_tomorrow", iCalUID: "u_e", date: "2026-11-21" },
  ];
  expect(buildDayView(date, [], events, null).calendarEvents.map((row) => row.id)).toEqual([
    "ce_span",
    "ce_a",
  ]);
});
