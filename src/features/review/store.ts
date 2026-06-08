import type { Slice } from "@/core/store/slice";
import { uid } from "@/core/lib/id";
import { savePut, saveRemove } from "@/core/store/persist";
import type { Review } from "./model";

export interface ReviewSlice {
  reviews: Review[];
  saveReview: (review: Omit<Review, "id" | "createdAt"> & Partial<Pick<Review, "id" | "createdAt">>) => Review;
  removeReview: (id: string) => void;
}

export const createReviewSlice: Slice<ReviewSlice> = (set, get) => ({
  reviews: [],

  saveReview: (input) => {
    // one review per period — overwrite if the week already has one
    const existing = get().reviews.find((r) => r.periodKey === input.periodKey && (!input.id || r.id === input.id));
    const review: Review = {
      id: input.id ?? existing?.id ?? uid("rv_"),
      periodKey: input.periodKey,
      prompts: input.prompts,
      completion: input.completion,
      createdAt: input.createdAt ?? new Date().toISOString(),
    };
    set((s) => {
      const rest = s.reviews.filter((r) => r.id !== review.id);
      return { reviews: [review, ...rest] };
    });
    savePut("reviews", review);
    return review;
  },

  removeReview: (id) => {
    set((s) => ({ reviews: s.reviews.filter((r) => r.id !== id) }));
    saveRemove("reviews", id);
  },
});
