import { protectedProcedure, router } from "../../trpc/trpc";

export const healthRouter = router({
  whoami: protectedProcedure.query(({ ctx }) => ({ uid: ctx.uid })),
});
