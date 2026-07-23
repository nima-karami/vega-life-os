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
  /** legacy single example — superseded by `examples`, kept inert for old records */
  example: string;
  /** American IPA, slash-delimited; "" = unknown */
  phonetic: string;
  examples: string[];
  synonyms: string[];
  language: string;
  /** Leitner box 1..5 for spaced repetition */
  box: number;
  lastReviewed: string | null; // ISO date
  nextDue: string | null; // ISO date
  addedAt: string; // ISO date
}

// Dexie loads skip schema parsing, so a legacy sandbox record may lack the array.
export function listVocabExamples(entry: VocabEntry): string[] {
  const authored = (entry.examples ?? []).filter((example) => example.trim() !== "");
  if (authored.length > 0) return authored;
  return entry.example ? [entry.example] : [];
}
