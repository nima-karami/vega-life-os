import { create } from "zustand";
import { persistence, buildSeed } from "@/core/persistence";
import type { RootState } from "./types";
import { createValuesSlice } from "@/features/values/store";
import { createGoalsSlice } from "@/features/goals/store";
import { createHabitsSlice } from "@/features/habits/store";
import { createTasksSlice } from "@/features/tasks/store";
import { createLibrarySlice } from "@/features/library/store";
import { createUiSlice } from "./ui";

export const useStore = create<RootState>((set, get, api) => ({
  ...createValuesSlice(set, get, api),
  ...createGoalsSlice(set, get, api),
  ...createHabitsSlice(set, get, api),
  ...createTasksSlice(set, get, api),
  ...createLibrarySlice(set, get, api),
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
      ready: true,
    });
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
    ]);
    set({
      values: seed.values,
      goals: seed.goals,
      habits: seed.habits,
      tasks: seed.tasks,
      books: seed.books,
      movies: seed.movies,
      vocab: seed.vocab,
    });
  },
}));
