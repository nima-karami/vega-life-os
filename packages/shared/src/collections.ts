import { z } from "zod";
import { bookCreateSchema, bookSchema } from "./entities/book";
import { calendarEventCreateSchema, calendarEventSchema } from "./entities/calendar-event";
import { goalCreateSchema, goalSchema } from "./entities/goal";
import { habitCreateSchema, habitSchema } from "./entities/habit";
import { dayEntryCreateSchema, dayEntrySchema } from "./entities/journal";
import { movieCreateSchema, movieSchema } from "./entities/movie";
import { reviewCreateSchema, reviewSchema } from "./entities/review";
import { taskCreateSchema, taskSchema } from "./entities/task";
import { valueCreateSchema, valueSchema } from "./entities/value";
import { vocabEntryCreateSchema, vocabEntrySchema } from "./entities/vocab";

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

/** Client-settable input schema per collection — server-owned meta + unknown keys stripped, not rejected. */
export const createSchemasByCollection = {
  values: valueCreateSchema,
  goals: goalCreateSchema,
  habits: habitCreateSchema,
  tasks: taskCreateSchema,
  books: bookCreateSchema,
  movies: movieCreateSchema,
  vocab: vocabEntryCreateSchema,
  reviews: reviewCreateSchema,
  journal: dayEntryCreateSchema,
  calendarEvents: calendarEventCreateSchema,
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
