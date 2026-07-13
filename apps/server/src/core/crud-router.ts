import { type CollectionName, createSchemasByCollection } from "@vega/shared";
import { z } from "zod";
import { protectedProcedure, router } from "../trpc/trpc";
import { createRepository, type WritableEntity } from "./repository";

const idInput = z.object({ id: z.string() });

/** One idempotent `list/get/upsert/delete` slice per collection — the shape every app-data domain shares. */
export function createCrudRouter<C extends CollectionName>(collection: C) {
  const upsertInput = createSchemasByCollection[collection] as unknown as z.ZodType<
    WritableEntity<C>
  >;
  const repo = (ctx: { firestore: Parameters<typeof createRepository>[0]; uid: string }) =>
    createRepository(ctx.firestore, ctx.uid, collection);

  return router({
    list: protectedProcedure.query(({ ctx }) => repo(ctx).list()),
    get: protectedProcedure.input(idInput).query(({ ctx, input }) => repo(ctx).get(input.id)),
    upsert: protectedProcedure
      .input(upsertInput)
      .mutation(({ ctx, input }) => repo(ctx).upsert(input as WritableEntity<C>)),
    delete: protectedProcedure.input(idInput).mutation(async ({ ctx, input }) => {
      await repo(ctx).remove(input.id);
      return { id: input.id };
    }),
  });
}
