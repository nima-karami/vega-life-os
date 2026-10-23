import type { CollectionName, SyncReceipt } from "@vega/shared";
import { z } from "zod";
import { shouldTriggerCalendarSync } from "../features/calendar/schedule-reconcile";
import { protectedProcedure, router } from "../trpc/trpc";
import { writableSchema, writeRecord } from "./collection-store";
import { createRepository, type WritableEntity } from "./repository";
import { toSyncedResponse, toWireRow, toWireRows } from "./wire";

const idInput = z.object({ id: z.string() });

/** One idempotent `list/get/upsert/delete` slice per collection — the shape every app-data domain shares. */
export function createCrudRouter<C extends CollectionName>(collection: C) {
  const repo = (ctx: { firestore: Parameters<typeof createRepository>[0]; uid: string }) =>
    createRepository(ctx.firestore, ctx.uid, collection);

  return router({
    list: protectedProcedure.query(async ({ ctx }) => toWireRows(await repo(ctx).list())),
    get: protectedProcedure.input(idInput).query(async ({ ctx, input }) => {
      const row = await repo(ctx).get(input.id);
      return row ? toWireRow(row) : null;
    }),
    upsert: protectedProcedure
      .input(writableSchema(collection))
      .mutation(async ({ ctx, input }) => {
        const written = writeRecord(ctx, collection, input as WritableEntity<C>);
        if (shouldTriggerCalendarSync(collection)) ctx.calendar.scheduleReconcile(ctx.uid);
        return toSyncedResponse(await written);
      }),
    delete: protectedProcedure
      .input(idInput)
      .mutation(async ({ ctx, input }): Promise<{ id: string } & SyncReceipt> => {
        const syncVersion = await repo(ctx).removeSynced(input.id);
        if (shouldTriggerCalendarSync(collection)) ctx.calendar.scheduleReconcile(ctx.uid);
        return { id: input.id, syncVersion };
      }),
  });
}
