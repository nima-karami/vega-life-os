import { DEFAULT_CARD_PREFS } from "@vega/shared";
import { startOfWeek } from "date-fns";
import { createEmptyDataset, type Dataset } from "../adapter";
import { buildCards } from "./cards";
import { buildFinance } from "./finance";
import { buildGoals } from "./goals";
import { buildHabits } from "./habits";
import { buildBooks, buildMovies, buildVocab } from "./library";
import { buildMindCards } from "./mind-cards";
import { buildReviews } from "./reviews";
import { buildTasks } from "./tasks";
import { buildValues } from "./values";

/**
 * Build the starter dataset anchored to the week containing `ref` (default now),
 * so whenever the user opens VEGA, "today" has a believable, partly-done queue.
 */
export function buildSeed(ref: Date = new Date()): Dataset {
  const ds = createEmptyDataset();
  const weekStart = startOfWeek(ref, { weekStartsOn: 1 }); // Monday

  ds.values = buildValues();
  ds.goals = buildGoals(weekStart, ref);
  ds.habits = buildHabits(weekStart);
  ds.tasks = buildTasks(ds.habits, ref, weekStart);
  ds.books = buildBooks(weekStart);
  ds.movies = buildMovies(weekStart);
  ds.vocab = buildVocab(ref, weekStart);
  ds.reviews = buildReviews(weekStart);
  ds.mindCards = buildMindCards();
  ds.cards = buildCards(ref, weekStart);
  // The seed IS the migrated shape — buildCards runs the migration's own mappers — so it
  // records the conversion as done. Without the stamp every sandbox boot re-runs the pass
  // and writes state after first paint.
  ds.cardPrefs = [{ ...DEFAULT_CARD_PREFS, migratedAt: ref.toISOString() }];

  return { ...ds, ...buildFinance(ref) };
}
