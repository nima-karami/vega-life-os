import { z } from "zod";
import { bookSchema } from "./entities/book";
import { calendarEventSchema } from "./entities/calendar-event";
import { goalSchema } from "./entities/goal";
import { habitSchema } from "./entities/habit";
import { dayEntrySchema } from "./entities/journal";
import { movieSchema } from "./entities/movie";
import { reviewSchema } from "./entities/review";
import { taskSchema } from "./entities/task";
import { valueSchema } from "./entities/value";
import { vocabEntrySchema } from "./entities/vocab";

/** Stored schema per collection — the registry the repository layer keys on. */
export const schemasByCollection = {
  values: valueSchema,
  goals: goalSchema,
  habits: habitSchema,
  tasks: taskSchema,
  books: bookSchema,
  movies: movieSchema,
  vocab: vocabEntrySchema,
  reviews: reviewSchema,
  journal: dayEntrySchema,
  calendarEvents: calendarEventSchema,
} as const;

export const COLLECTIONS = [
  "values",
  "goals",
  "habits",
  "tasks",
  "books",
  "movies",
  "vocab",
  "reviews",
  "journal",
  "calendarEvents",
] as const;

export const collectionNameSchema = z.enum(COLLECTIONS);
export type CollectionName = (typeof COLLECTIONS)[number];

export type Dataset = {
  [C in CollectionName]: z.infer<(typeof schemasByCollection)[C]>[];
};
