import { createEmptyDataset, type Dataset } from "../adapter";
import { buildBacklog } from "./backlog";
import { createSeedContext } from "./context";
import { buildGoals } from "./goals";
import { buildHabits } from "./habits";
import { buildLibrary } from "./library";
import { buildTasks } from "./tasks";
import { buildValues } from "./values";

// energy lens (charge / drain) by activity — what lifts vs. costs you
const ENERGY_BY_TITLE: Record<string, "charge" | "drain" | "neutral"> = {
  "Read 1h before bed": "charge",
  "Read — finish 'Sapiens' ch.9": "charge",
  "Apply to 1 role": "drain",
  "Lights out by 22:30": "neutral",
  "Morning walk": "charge",
  "Workout 30 min": "charge",
  "Pay the bills": "drain",
  "Tidy 15 min": "neutral",
  "Call family": "charge",
  "Update ID card": "drain",
  "Mock interview w/ Dana": "drain",
  "Negotiation prep doc": "drain",
  "Sort out tax documents": "drain",
  "Renew passport": "drain",
  "Set up reading nook": "charge",
  "Buy blackout curtains": "neutral",
  "Plan a long weekend trip": "charge",
};

/**
 * Build the starter dataset anchored to the week containing `ref` (default now),
 * so whenever the user opens VEGA, "today" has a believable, partly-done queue.
 */
export function buildSeed(ref: Date = new Date()): Dataset {
  const ds = createEmptyDataset();
  const ctx = createSeedContext(ref);

  ds.values = buildValues();
  ds.goals = buildGoals(ctx);

  const habits = buildHabits(ctx);
  ds.habits = habits;

  ds.tasks = buildTasks(ctx, habits);
  ds.tasks.push(...buildBacklog(ctx));
  ds.tasks.forEach((t) => {
    t.energy = ENERGY_BY_TITLE[t.title] ?? "neutral";
  });

  const { books, movies, vocab, reviews } = buildLibrary(ctx);
  ds.books = books;
  ds.movies = movies;
  ds.vocab = vocab;
  ds.reviews = reviews;

  return ds;
}
