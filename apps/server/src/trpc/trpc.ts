import { initTRPC } from "@trpc/server";
import { AppError, PartialCommitError, toTrpcError } from "../core/errors";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create({
  // Which chunks landed is the only server state a failed bulk write leaves behind; the client
  // needs it to report the failure, and the default error shape drops it.
  errorFormatter({ shape, error }) {
    if (!(error.cause instanceof PartialCommitError)) return shape;
    return { ...shape, data: { ...shape.data, partialCommit: error.cause.detail } };
  },
});

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.uid) throw toTrpcError(new AppError("UNAUTHORIZED", "sign-in required"));
  return next({ ctx: { ...ctx, uid: ctx.uid } });
});
