import { type CollectionName, createSchemasByCollection } from "@vega/shared";
import type { Firestore } from "firebase-admin/firestore";
import type { z } from "zod";
import { AppError, toTrpcError } from "./errors";
import {
  createRepository,
  type StoredEntity,
  type SyncedWrite,
  type WritableEntity,
} from "./repository";

export type RepoContext = { firestore: Firestore; uid: string };

/** The create-schema for a collection, cast to the writable-entity shape the repository accepts. */
export function writableSchema<C extends CollectionName>(
  collection: C,
): z.ZodType<WritableEntity<C>> {
  return createSchemasByCollection[collection] as unknown as z.ZodType<WritableEntity<C>>;
}

/** Validate a client-supplied record against its collection's create-schema, or reject with BAD_REQUEST. */
export function parseRecord<C extends CollectionName>(
  collection: C,
  record: unknown,
): WritableEntity<C> {
  const result = writableSchema(collection).safeParse(record);
  if (!result.success) throw toTrpcError(new AppError("BAD_REQUEST", result.error.message));
  return result.data;
}

/** Upsert a validated record through the uid-scoped repository — the one write path both routers share. */
export function writeRecord<C extends CollectionName>(
  ctx: RepoContext,
  collection: C,
  record: WritableEntity<C>,
): Promise<SyncedWrite<StoredEntity<C>>> {
  return createRepository(ctx.firestore, ctx.uid, collection).upsertSynced(record);
}
