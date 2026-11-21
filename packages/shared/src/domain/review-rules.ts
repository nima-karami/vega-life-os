import type { ReviewCreate } from "../entities/review";
import { uid } from "./id";

type Review = Pick<ReviewCreate, "id" | "periodKey" | "createdAt" | "checkIns" | "prompts">;
export function resolveReviewForSave(
  reviews: Review[],
  input: Omit<Review, "id" | "createdAt"> & Partial<Pick<Review, "id" | "createdAt">>,
  nowIso = new Date().toISOString(),
  makeId = uid,
) {
  // one review per period — overwrite if the week already has one
  const existing = reviews.find(
    (r) => r.periodKey === input.periodKey && (!input.id || r.id === input.id),
  );
  const review: Review = {
    id: input.id ?? existing?.id ?? makeId("rv_"),
    periodKey: input.periodKey,
    prompts: input.prompts,
    checkIns: input.checkIns,
    createdAt: input.createdAt ?? nowIso,
  };
  return {
    record: review,
    conflictWith:
      input.id != null
        ? (reviews.find((row) => row.id !== input.id && row.periodKey === input.periodKey)?.id ??
          null)
        : null,
  };
}
