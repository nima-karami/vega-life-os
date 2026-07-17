import { profilePatchSchema } from "@vega/shared";
import { FieldValue } from "firebase-admin/firestore";
import { protectedProcedure, router } from "../../trpc/trpc";

/**
 * The user-level profile doc at `users/{uid}` — the one document outside the
 * per-collection repository (identity + cloud-mirrored gcal/streak config).
 * Merge-patched via Admin so the client never writes Firestore directly.
 */
export const profileRouter = router({
  upsert: protectedProcedure.input(profilePatchSchema).mutation(async ({ ctx, input }) => {
    await ctx.firestore
      .doc(`users/${ctx.uid}`)
      .set({ ...input, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    return { ok: true as const };
  }),
});
