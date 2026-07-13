import { initTRPC } from "@trpc/server";
import { AppError, toTrpcError } from "../core/errors";
import type { Context } from "./context";

const t = initTRPC.context<Context>().create();

export const router = t.router;
export const createCallerFactory = t.createCallerFactory;

export const protectedProcedure = t.procedure.use(({ ctx, next }) => {
  if (!ctx.uid) throw toTrpcError(new AppError("UNAUTHORIZED", "sign-in required"));
  return next({ ctx: { ...ctx, uid: ctx.uid } });
});
