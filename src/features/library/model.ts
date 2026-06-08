/**
 * Library "collections" — an extensible pattern. Books is built out; Movies and
 * Vocabulary ride the same shape so new collections are cheap to add.
 */

export type BookStatus = "queued" | "reading" | "finished" | "abandoned";

export interface Book {
  id: string;
  title: string;
  author: string;
  status: BookStatus;
  rating: number | null; // 0..5
  pages: number | null;
  currentPage: number | null;
  startedAt: string | null; // ISO date
  finishedAt: string | null; // ISO date
  /** optional link to a value this reading serves */
  valueId: string | null;
  note: string;
  order: number;
}

export type MovieStatus = "queued" | "watched";

export interface Movie {
  id: string;
  title: string;
  year: number | null;
  director: string;
  status: MovieStatus;
  rating: number | null; // 0..5
  watchedAt: string | null; // ISO date
  note: string;
  order: number;
}

export interface VocabEntry {
  id: string;
  term: string;
  definition: string;
  example: string;
  language: string;
  /** Leitner box 1..5 for spaced repetition */
  box: number;
  lastReviewed: string | null; // ISO date
  nextDue: string | null; // ISO date
  addedAt: string; // ISO date
}
