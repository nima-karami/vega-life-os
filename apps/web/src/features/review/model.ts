export interface ReviewPrompt {
  q: string;
  a: string;
}

/** A saved weekly reflection — guided journaling tied to a week. */
export interface Review {
  id: string;
  /** ISO date of the week's Monday, e.g. "2026-06-08" */
  periodKey: string;
  prompts: ReviewPrompt[];
  /** completion rate snapshot at save time (0..1) */
  completion: number;
  createdAt: string;
}

export const REVIEW_PROMPTS = [
  "What went well this week?",
  "What slipped, and why?",
  "Which value got too little of you?",
  "The one thing that matters most next week:",
];
