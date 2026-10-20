export interface ReviewPrompt {
  q: string;
  a: string;
}

/** A self-rated 1..5 sense of how consistently a value was lived that week. */
export interface ReviewCheckIn {
  valueId: string;
  rating: number;
}

/** A saved weekly reflection — guided journaling tied to a week. */
export interface Review {
  id: string;
  /** ISO date of the week's Monday, e.g. "2026-06-08" */
  periodKey: string;
  prompts: ReviewPrompt[];
  checkIns: ReviewCheckIn[];
  createdAt: string;
}

export const REVIEW_PROMPTS = [
  "What are you glad you did this week?",
  "What got in the way? What's one small next step?",
  "Which value do you want to give more of yourself to next week?",
  "The one thing that matters most next week:",
];

export const CHECK_IN_LABELS = ["Not really", "A little", "Somewhat", "Mostly", "Fully"] as const;

/** Legacy stored reviews predate check-ins; the Zod default only runs on the server path. */
export function normalizeReview(review: Review): Review {
  return { ...review, checkIns: review.checkIns ?? [] };
}
