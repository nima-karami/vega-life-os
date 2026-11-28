import { accessTokenCreateInputSchema, accessTokenRevokeInputSchema } from "@vega/shared";
import { AppError, toTrpcError } from "../../core/errors";
import { protectedProcedure, router } from "../../trpc/trpc";
import { createAccessToken, listAccessTokens, revokeAccessToken } from "./token-store";

async function runWithTrpcErrors<T>(work: () => Promise<T>): Promise<T> {
  try {
    return await work();
  } catch (error) {
    throw error instanceof AppError ? toTrpcError(error) : error;
  }
}

export const accessTokensRouter = router({
  list: protectedProcedure.query(({ ctx }) => listAccessTokens(ctx.firestore, ctx.uid)),
  create: protectedProcedure
    .input(accessTokenCreateInputSchema)
    .mutation(({ ctx, input }) =>
      runWithTrpcErrors(() =>
        createAccessToken(ctx.firestore, ctx.uid, input, new Date().toISOString()),
      ),
    ),
  revoke: protectedProcedure
    .input(accessTokenRevokeInputSchema)
    .mutation(async ({ ctx, input }) => {
      await runWithTrpcErrors(() =>
        revokeAccessToken(ctx.firestore, ctx.uid, input.id, new Date().toISOString()),
      );
      return { ok: true as const };
    }),
});
