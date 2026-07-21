import type { CollectionName } from "@vega/shared";
import { z } from "zod";
import { shouldTriggerCalendarSync } from "../features/calendar/schedule-reconcile";
import { protectedProcedure, router } from "../trpc/trpc";
import { writableSchema, writeRecord } from "./collection-store";
import { createRepository, type WritableEntity } from "./repository";

const idInput = z.object({ id: z.string() });

/** One idempotent `list/get/upsert/delete` slice per collection — the shape every app-data domain shares. */
export function createCrudRouter<C extends CollectionName>(collection: C) {
  const repo = (ctx: { firestore: Parameters<typeof createRepository>[0]; uid: string }) =>
    createRepository(ctx.firestore, ctx.uid, collection);

  return router({
    list: protectedProcedure.query(({ ctx }) => repo(ctx).list()),
    get: protectedProcedure.input(idInput).query(({ ctx, input }) => repo(ctx).get(input.id)),
    upsert: protectedProcedure.input(writableSchema(collection)).mutation(({ ctx, input }) => {
      const written = writeRecord(ctx, collection, input as WritableEntity<C>);
      if (shouldTriggerCalendarSync(collection)) ctx.calendar.scheduleReconcile(ctx.uid);
      return written;
    }),
    delete: protectedProcedure.input(idInput).mutation(async ({ ctx, input }) => {
      await repo(ctx).remove(input.id);
      if (shouldTriggerCalendarSync(collection)) ctx.calendar.scheduleReconcile(ctx.uid);
      return { id: input.id };
    }),
  });
}
