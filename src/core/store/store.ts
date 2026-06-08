import { create } from "zustand";
import { persistence, buildSeed, COLLECTIONS } from "@/core/persistence";
import type { Dataset, CollectionName } from "@/core/persistence";
import type { RootState } from "./types";
import { createValuesSlice } from "@/features/values/store";
import { createGoalsSlice } from "@/features/goals/store";
import { createHabitsSlice } from "@/features/habits/store";
import { createTasksSlice } from "@/features/tasks/store";
import { createLibrarySlice } from "@/features/library/store";
import { createReviewSlice } from "@/features/review/store";
import { createUiSlice } from "./ui";

export const useStore = create<RootState>((set, get, api) => ({
  ...createValuesSlice(set, get, api),
  ...createGoalsSlice(set, get, api),
  ...createHabitsSlice(set, get, api),
  ...createTasksSlice(set, get, api),
  ...createLibrarySlice(set, get, api),
  ...createReviewSlice(set, get, api),
  ...createUiSlice(set, get, api),

  ready: false,

  bootstrap: async () => {
    await persistence.init();
    if (await persistence.isEmpty()) {
      const seed = buildSeed();
      await Promise.all([
        persistence.bulkPut("values", seed.values),
        persistence.bulkPut("goals", seed.goals),
        persistence.bulkPut("habits", seed.habits),
        persistence.bulkPut("tasks", seed.tasks),
        persistence.bulkPut("books", seed.books),
        persistence.bulkPut("movies", seed.movies),
        persistence.bulkPut("vocab", seed.vocab),
        persistence.bulkPut("reviews", seed.reviews),
      ]);
    }
    const data = await persistence.loadAll();
    set({
      values: data.values.sort((a, b) => a.order - b.order),
      goals: data.goals.sort((a, b) => a.order - b.order),
      habits: data.habits,
      tasks: data.tasks,
      books: data.books.sort((a, b) => a.order - b.order),
      movies: data.movies.sort((a, b) => a.order - b.order),
      vocab: data.vocab,
      reviews: data.reviews.sort((a, b) => (a.periodKey < b.periodKey ? 1 : -1)),
      ready: true,
    });
    // keep the runway populated so habits actually recur without manual planning
    get().ensureUpcoming(14);
  },

  reseed: async () => {
    await persistence.clearAll();
    const seed = buildSeed();
    await Promise.all([
      persistence.bulkPut("values", seed.values),
      persistence.bulkPut("goals", seed.goals),
      persistence.bulkPut("habits", seed.habits),
      persistence.bulkPut("tasks", seed.tasks),
      persistence.bulkPut("books", seed.books),
      persistence.bulkPut("movies", seed.movies),
      persistence.bulkPut("vocab", seed.vocab),
      persistence.bulkPut("reviews", seed.reviews),
    ]);
    set({
      values: seed.values,
      goals: seed.goals,
      habits: seed.habits,
      tasks: seed.tasks,
      books: seed.books,
      movies: seed.movies,
      vocab: seed.vocab,
      reviews: seed.reviews,
    });
  },

  wipe: async () => {
    await persistence.clearAll();
    set({ values: [], goals: [], habits: [], tasks: [], books: [], movies: [], vocab: [], reviews: [] });
  },

  exportJSON: () => {
    const s = get();
    const data: Dataset = {
      values: s.values, goals: s.goals, habits: s.habits, tasks: s.tasks,
      books: s.books, movies: s.movies, vocab: s.vocab, reviews: s.reviews,
    };
    return JSON.stringify({ app: "vega-life-os", version: 1, exportedAt: new Date().toISOString(), data }, null, 2);
  },

  importJSON: async (text) => {
    let parsed: { data?: Partial<Dataset> };
    try {
      parsed = JSON.parse(text);
    } catch {
      return false;
    }
    const data = parsed?.data;
    if (!data || typeof data !== "object") return false;
    await persistence.clearAll();
    const next: Partial<Dataset> = {};
    for (const col of COLLECTIONS) {
      const arr = (data as Record<CollectionName, unknown>)[col];
      if (Array.isArray(arr)) {
        await persistence.bulkPut(col, arr as never);
        (next as Record<string, unknown>)[col] = arr;
      }
    }
    set(next as Partial<RootState>);
    return true;
  },
}));
