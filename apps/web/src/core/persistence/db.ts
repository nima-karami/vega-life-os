import type { CalendarEvent } from "@vega/shared";
import Dexie, { type Table } from "dexie";
import type { Goal } from "@/features/goals/model";
import type { Habit } from "@/features/habits/model";
import type { DayEntry } from "@/features/journal/model";
import type { Book, Movie, VocabEntry } from "@/features/library/model";
import type { Review } from "@/features/review/model";
import type { Task } from "@/features/tasks/model";
import type { Value } from "@/features/values/model";

export class VegaDB extends Dexie {
  values!: Table<Value, string>;
  goals!: Table<Goal, string>;
  habits!: Table<Habit, string>;
  tasks!: Table<Task, string>;
  books!: Table<Book, string>;
  movies!: Table<Movie, string>;
  vocab!: Table<VocabEntry, string>;
  reviews!: Table<Review, string>;
  journal!: Table<DayEntry, string>;
  calendarEvents!: Table<CalendarEvent, string>;
  meta!: Table<{ key: string; dirty?: boolean }, string>;

  constructor() {
    super("vega-life-os");
    const stores = {
      // only index fields we actually query on; Dexie stores the whole object
      values: "id, order",
      goals: "id, valueId, order",
      habits: "id, valueId, goalId",
      tasks: "id, date, status, kind, habitId, goalId, valueId, order",
      books: "id, status, order",
      movies: "id, status, order",
      vocab: "id, box, nextDue",
    };
    this.version(1).stores(stores);
    this.version(2).stores({ ...stores, reviews: "id, periodKey" });
    this.version(3).stores({ ...stores, reviews: "id, periodKey", journal: "id, date" });
    this.version(4).stores({
      ...stores,
      reviews: "id, periodKey",
      journal: "id, date",
      meta: "key",
    });
    this.version(5).stores({
      ...stores,
      reviews: "id, periodKey",
      journal: "id, date",
      meta: "key",
      calendarEvents: "id, calendarId, iCalUID, valueId, date",
    });
  }
}

export const db = new VegaDB();
