import { collectionNameSchema, type SyncReceipt, type WireDataset } from "@vega/shared";
import { z } from "zod";
import { parseRecord, writeRecord } from "../../core/collection-store";
import { createRepository } from "../../core/repository";
import { advanceSyncVersion, readSyncVersion } from "../../core/sync-version";
import { writeTombstone } from "../../core/tombstone";
import { toSyncedResponse, toWireRows } from "../../core/wire";
import { protectedProcedure, router } from "../../trpc/trpc";
import { shouldTriggerCalendarSync } from "../calendar/schedule-reconcile";
import { importRecords } from "./batch-import";
import { removeRecords } from "./batch-remove";

const unknownRecord = z.record(z.string(), z.unknown());

/**
 * Collection-agnostic writes for paths the domain routers don't cover: the
 * `calendarEvents` mirror (no domain router) and the client's bulk import /
 * wipe-all flows. Each write re-validates against the collection's create schema,
 * so it is exactly as strict as a domain router.
 */
export const dataRouter = router({
  list: protectedProcedure
    .input(z.object({ collection: collectionNameSchema }))
    .query(async ({ ctx, input }) =>
      toWireRows(await createRepository(ctx.firestore, ctx.uid, input.collection).list()),
    ),

  /** One read that answers "has anything changed?", so an idle client never pulls the dataset. */
  syncVersion: protectedProcedure.query(({ ctx }) => readSyncVersion(ctx.firestore, ctx.uid)),

  loadAll: protectedProcedure.query(async ({ ctx }): Promise<WireDataset> => {
    const collections = collectionNameSchema.options;
    const lists = await Promise.all(
      collections.map((collection) => createRepository(ctx.firestore, ctx.uid, collection).list()),
    );
    return Object.fromEntries(
      collections.map((collection, index) => [collection, toWireRows(lists[index])]),
    ) as WireDataset;
  }),

  upsert: protectedProcedure
    .input(z.object({ collection: collectionNameSchema, record: unknownRecord }))
    .mutation(async ({ ctx, input }) => {
      const written = writeRecord(
        ctx,
        input.collection,
        parseRecord(input.collection, input.record),
      );
      if (shouldTriggerCalendarSync(input.collection)) ctx.calendar.scheduleReconcile(ctx.uid);
      return toSyncedResponse(await written);
    }),

  remove: protectedProcedure
    .input(z.object({ collection: collectionNameSchema, id: z.string() }))
    .mutation(async ({ ctx, input }): Promise<{ id: string } & SyncReceipt> => {
      const repository = createRepository(ctx.firestore, ctx.uid, input.collection);
      const syncVersion = await repository.removeSynced(input.id);
      if (shouldTriggerCalendarSync(input.collection)) ctx.calendar.scheduleReconcile(ctx.uid);
      return { id: input.id, syncVersion };
    }),

  importCollection: protectedProcedure
    .input(z.object({ collection: collectionNameSchema, records: z.array(unknownRecord) }))
    .mutation(async ({ ctx, input }) => {
      const result = await importRecords(
        ctx.firestore,
        ctx.uid,
        input.collection,
        input.records,
        ctx.calendar.now(),
      );
      if (shouldTriggerCalendarSync(input.collection)) ctx.calendar.scheduleReconcile(ctx.uid);
      return result;
    }),

  bulkRemove: protectedProcedure
    .input(z.object({ collection: collectionNameSchema, ids: z.array(z.string()) }))
    .mutation(async ({ ctx, input }) => {
      const result = await removeRecords(
        ctx.firestore,
        ctx.uid,
        input.collection,
        input.ids,
        ctx.calendar.now(),
      );
      if (shouldTriggerCalendarSync(input.collection)) ctx.calendar.scheduleReconcile(ctx.uid);
      return result;
    }),

  deleteAll: protectedProcedure.mutation(async ({ ctx }): Promise<{ ok: true } & SyncReceipt> => {
    const now = ctx.calendar.now();
    for (const collection of collectionNameSchema.options) {
      const col = ctx.firestore.collection(`users/${ctx.uid}/${collection}`);
      const snap = await col.get();
      // A wiped mirror event resurrects on the next gcal reconcile unless its googleId is
      // tombstoned — the reconcile keys resurrection on googleId, not the record id.
      if (collection === "calendarEvents") {
        for (const doc of snap.docs) {
          const googleId = (doc.data() as { googleId?: string }).googleId;
          if (googleId)
            await writeTombstone(ctx.firestore, ctx.uid, "calendarEvents", googleId, now);
        }
      }
      for (let i = 0; i < snap.docs.length; i += 450) {
        const batch = ctx.firestore.batch();
        for (const doc of snap.docs.slice(i, i + 450)) batch.delete(doc.ref);
        await batch.commit();
      }
    }
    // The batched deletes bypass the repository, so the counter has to be bumped by hand or a
    // polling client would never learn the wipe happened.
    const syncVersion = await advanceSyncVersion(ctx.firestore, ctx.uid);
    ctx.calendar.scheduleReconcile(ctx.uid);
    return { ok: true, syncVersion };
  }),
});
