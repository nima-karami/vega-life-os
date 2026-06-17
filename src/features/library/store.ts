import { addDays, format } from "date-fns";
import { todayISO } from "@/core/lib/date";
import { uid } from "@/core/lib/id";
import { savePut, saveRemove } from "@/core/store/persist";
import type { Slice } from "@/core/store/slice";
import type { Book, Movie, VocabEntry } from "./model";

export interface LibrarySlice {
  books: Book[];
  movies: Movie[];
  vocab: VocabEntry[];

  addBook: (patch?: Partial<Book>) => Book;
  updateBook: (id: string, patch: Partial<Book>) => void;
  removeBook: (id: string) => void;

  addMovie: (patch?: Partial<Movie>) => Movie;
  updateMovie: (id: string, patch: Partial<Movie>) => void;
  removeMovie: (id: string) => void;

  addVocab: (patch?: Partial<VocabEntry>) => VocabEntry;
  updateVocab: (id: string, patch: Partial<VocabEntry>) => void;
  removeVocab: (id: string) => void;
  /** Leitner review: correct bumps the box, wrong resets to 1 */
  reviewVocab: (id: string, correct: boolean) => void;
}

const LEITNER_DAYS = [0, 1, 2, 4, 8, 16];

export const createLibrarySlice: Slice<LibrarySlice> = (set, get) => ({
  books: [],
  movies: [],
  vocab: [],

  addBook: (patch = {}) => {
    const book: Book = {
      id: patch.id ?? uid("b_"),
      title: patch.title ?? "Untitled",
      author: patch.author ?? "",
      status: patch.status ?? "queued",
      rating: patch.rating ?? null,
      pages: patch.pages ?? null,
      currentPage: patch.currentPage ?? null,
      startedAt: patch.startedAt ?? null,
      finishedAt: patch.finishedAt ?? null,
      valueId: patch.valueId ?? null,
      note: patch.note ?? "",
      order: patch.order ?? get().books.length,
    };
    set((s) => ({ books: [...s.books, book] }));
    savePut("books", book);
    return book;
  },
  updateBook: (id, patch) => {
    let next: Book | undefined;
    set((s) => ({
      books: s.books.map((b) => {
        if (b.id !== id) return b;
        next = { ...b, ...patch, id };
        return next;
      }),
    }));
    if (next) savePut("books", next);
  },
  removeBook: (id) => {
    set((s) => ({ books: s.books.filter((b) => b.id !== id) }));
    saveRemove("books", id);
  },

  addMovie: (patch = {}) => {
    const movie: Movie = {
      id: patch.id ?? uid("m_"),
      title: patch.title ?? "Untitled",
      year: patch.year ?? null,
      director: patch.director ?? "",
      status: patch.status ?? "queued",
      rating: patch.rating ?? null,
      watchedAt: patch.watchedAt ?? null,
      note: patch.note ?? "",
      order: patch.order ?? get().movies.length,
    };
    set((s) => ({ movies: [...s.movies, movie] }));
    savePut("movies", movie);
    return movie;
  },
  updateMovie: (id, patch) => {
    let next: Movie | undefined;
    set((s) => ({
      movies: s.movies.map((m) => {
        if (m.id !== id) return m;
        next = { ...m, ...patch, id };
        return next;
      }),
    }));
    if (next) savePut("movies", next);
  },
  removeMovie: (id) => {
    set((s) => ({ movies: s.movies.filter((m) => m.id !== id) }));
    saveRemove("movies", id);
  },

  addVocab: (patch = {}) => {
    const entry: VocabEntry = {
      id: patch.id ?? uid("w_"),
      term: patch.term ?? "",
      definition: patch.definition ?? "",
      example: patch.example ?? "",
      language: patch.language ?? "English",
      box: patch.box ?? 1,
      lastReviewed: patch.lastReviewed ?? null,
      nextDue: patch.nextDue ?? todayISO(),
      addedAt: patch.addedAt ?? todayISO(),
    };
    set((s) => ({ vocab: [...s.vocab, entry] }));
    savePut("vocab", entry);
    return entry;
  },
  updateVocab: (id, patch) => {
    let next: VocabEntry | undefined;
    set((s) => ({
      vocab: s.vocab.map((w) => {
        if (w.id !== id) return w;
        next = { ...w, ...patch, id };
        return next;
      }),
    }));
    if (next) savePut("vocab", next);
  },
  removeVocab: (id) => {
    set((s) => ({ vocab: s.vocab.filter((w) => w.id !== id) }));
    saveRemove("vocab", id);
  },
  reviewVocab: (id, correct) => {
    const w = get().vocab.find((x) => x.id === id);
    if (!w) return;
    const box = correct ? Math.min(5, w.box + 1) : 1;
    const next: VocabEntry = {
      ...w,
      box,
      lastReviewed: todayISO(),
      nextDue: format(addDays(new Date(), LEITNER_DAYS[box]), "yyyy-MM-dd"),
    };
    set((s) => ({ vocab: s.vocab.map((x) => (x.id === id ? next : x)) }));
    savePut("vocab", next);
  },
});
