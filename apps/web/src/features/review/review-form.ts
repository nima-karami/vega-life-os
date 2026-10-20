import type { Value } from "@/features/values/model";
import { REVIEW_PROMPTS, type Review, type ReviewCheckIn, type ReviewPrompt } from "./model";

export function splitReviewPrompts(existing: Review | undefined): {
  answers: string[];
  legacy: ReviewPrompt[];
} {
  const stored = existing?.prompts ?? [];
  return {
    answers: REVIEW_PROMPTS.map((q) => stored.find((p) => p.q === q)?.a ?? ""),
    legacy: stored.filter((p) => !REVIEW_PROMPTS.includes(p.q)),
  };
}

export function mergePromptsForSave(answers: string[], legacy: ReviewPrompt[]): ReviewPrompt[] {
  return [...REVIEW_PROMPTS.map((q, i) => ({ q, a: answers[i] })), ...legacy];
}

export function toggleCheckIn(
  checkIns: ReviewCheckIn[],
  valueId: string,
  rating: number,
): ReviewCheckIn[] {
  const current = checkIns.find((c) => c.valueId === valueId);
  if (current?.rating === rating) return checkIns.filter((c) => c.valueId !== valueId);
  if (current) return checkIns.map((c) => (c.valueId === valueId ? { valueId, rating } : c));
  return [...checkIns, { valueId, rating }];
}

export function listCheckInValues(values: Value[], checkIns: ReviewCheckIn[]): Value[] {
  const rated = new Set(checkIns.map((c) => c.valueId));
  return values.filter((v) => v.archivedAt == null || rated.has(v.id));
}

export function haveCheckInsChanged(a: ReviewCheckIn[], b: ReviewCheckIn[]): boolean {
  if (a.length !== b.length) return true;
  const ratings = new Map(a.map((c) => [c.valueId, c.rating]));
  return b.some((c) => ratings.get(c.valueId) !== c.rating);
}
