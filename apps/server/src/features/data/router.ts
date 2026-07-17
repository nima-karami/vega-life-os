import { collectionNameSchema, type Dataset } from "@vega/shared";
import { z } from "zod";
import { parseRecord, writeRecord } from "../../core/collection-store";
import { createRepository } from "../../core/repository";
import { protectedProcedure, router } from "../../trpc/trpc";

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
    .query(({ ctx, input }) => createRepository(ctx.firestore, ctx.uid, input.collection).list()),

  loadAll: protectedProcedure.query(async ({ ctx }): Promise<Dataset> => {
    const collections = collectionNameSchema.options;
    const lists = await Promise.all(
      collections.map((collection) => createRepository(ctx.firestore, ctx.uid, collection).list()),
    );
    return Object.fromEntries(
      collections.map((collection, index) => [collection, lists[index]]),
    ) as Dataset;
  }),

  upsert: protectedProcedure
    .input(z.object({ collection: collectionNameSchema, record: unknownRecord }))
    .mutation(({ ctx, input }) =>
      writeRecord(ctx, input.collection, parseRecord(input.collection, input.record)),
    ),

  remove: protectedProcedure
    .input(z.object({ collection: collectionNameSchema, id: z.string() }))
    .mutation(async ({ ctx, input }) => {
      await createRepository(ctx.firestore, ctx.uid, input.collection).remove(input.id);
      return { id: input.id };
    }),

  importCollection: protectedProcedure
    .input(z.object({ collection: collectionNameSchema, records: z.array(unknownRecord) }))
    .mutation(async ({ ctx, input }) => {
      const repo = createRepository(ctx.firestore, ctx.uid, input.collection);
      for (const raw of input.records) await repo.upsert(parseRecord(input.collection, raw));
      return { count: input.records.length };
    }),

  deleteAll: protectedProcedure.mutation(async ({ ctx }) => {
    for (const collection of collectionNameSchema.options) {
      const col = ctx.firestore.collection(`users/${ctx.uid}/${collection}`);
      const snap = await col.get();
      for (let i = 0; i < snap.docs.length; i += 450) {
        const batch = ctx.firestore.batch();
        for (const doc of snap.docs.slice(i, i + 450)) batch.delete(doc.ref);
        await batch.commit();
      }
    }
    return { ok: true };
  }),
});
