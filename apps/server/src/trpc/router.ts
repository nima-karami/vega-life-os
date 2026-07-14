import { booksRouter } from "../features/books/router";
import { calendarRouter } from "../features/calendar/router";
import { dataRouter } from "../features/data/router";
import { goalsRouter } from "../features/goals/router";
import { habitsRouter } from "../features/habits/router";
import { healthRouter } from "../features/health/router";
import { journalRouter } from "../features/journal/router";
import { moviesRouter } from "../features/movies/router";
import { reviewsRouter } from "../features/reviews/router";
import { tasksRouter } from "../features/tasks/router";
import { valuesRouter } from "../features/values/router";
import { vocabRouter } from "../features/vocab/router";
import { router } from "./trpc";

export const appRouter = router({
  health: healthRouter,
  tasks: tasksRouter,
  habits: habitsRouter,
  values: valuesRouter,
  goals: goalsRouter,
  journal: journalRouter,
  books: booksRouter,
  movies: moviesRouter,
  vocab: vocabRouter,
  reviews: reviewsRouter,
  calendar: calendarRouter,
  data: dataRouter,
});

export type AppRouter = typeof appRouter;
