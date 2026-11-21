import { resolveReviewForSave, uid } from "@vega/shared";
import { savePut, saveRemove } from "@/core/store/persist";
import type { Slice } from "@/core/store/slice";
import type { Review } from "./model";

export interface ReviewSlice {
  reviews: Review[];
  saveReview: (
    review: Omit<Review, "id" | "createdAt"> & Partial<Pick<Review, "id" | "createdAt">>,
  ) => Review;
  removeReview: (id: string) => void;
}

export const createReviewSlice: Slice<ReviewSlice> = (set, get) => ({
  reviews: [],

  saveReview: (input) => {
    const { record: review } = resolveReviewForSave(get().reviews, input, undefined, uid);
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
