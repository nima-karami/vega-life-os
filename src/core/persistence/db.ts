import Dexie, { type Table } from "dexie";
import type { Value } from "@/features/values/model";
import type { Goal } from "@/features/goals/model";
import type { Habit } from "@/features/habits/model";
import type { Task } from "@/features/tasks/model";
import type { Book, Movie, VocabEntry } from "@/features/library/model";

export class VegaDB extends Dexie {
  values!: Table<Value, string>;
  goals!: Table<Goal, string>;
  habits!: Table<Habit, string>;
  tasks!: Table<Task, string>;
  books!: Table<Book, string>;
  movies!: Table<Movie, string>;
  vocab!: Table<VocabEntry, string>;

  constructor() {
    super("vega-life-os");
    this.version(1).stores({
      // only index fields we actually query on; Dexie stores the whole object
      values: "id, order",
      goals: "id, valueId, order",
      habits: "id, valueId, goalId",
      tasks: "id, date, status, kind, habitId, goalId, valueId, order",
      books: "id, status, order",
      movies: "id, status, order",
      vocab: "id, box, nextDue",
    });
  }
}

export const db = new VegaDB();
