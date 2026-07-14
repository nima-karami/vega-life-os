import { type CollectionName, collectionNameSchema, createSchemasByCollection } from "@vega/shared";
import { z } from "zod";
import { AppError, toTrpcError } from "../../core/errors";
import { createRepository, type WritableEntity } from "../../core/repository";
import { protectedProcedure, router } from "../../trpc/trpc";

const unknownRecord = z.record(z.string(), z.unknown());

function parseRecord(collection: CollectionName, record: unknown): WritableEntity<CollectionName> {
  const schema = createSchemasByCollection[collection] as unknown as z.ZodType<
    WritableEntity<CollectionName>
  >;
  const result = schema.safeParse(record);
  if (!result.success) throw toTrpcError(new AppError("BAD_REQUEST", result.error.message));
  return result.data;
}

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

  upsert: protectedProcedure
    .input(z.object({ collection: collectionNameSchema, record: unknownRecord }))
    .mutation(({ ctx, input }) => {
      const record = parseRecord(input.collection, input.record);
      return createRepository(ctx.firestore, ctx.uid, input.collection).upsert(record);
    }),

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
