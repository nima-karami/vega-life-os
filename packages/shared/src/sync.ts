import { z } from "zod";
import { collectionNameSchema } from "./collections";

/** Field → ISO timestamp map for server-computed field-level last-writer-wins. */
export const fieldMetaSchema = z.record(z.string(), z.string());

/** A deleted doc retained (30-day window) so a stale mirror never re-creates it. */
export const tombstoneSchema = z
  .object({
    id: z.string(),
    collection: collectionNameSchema,
    deletedAt: z.string(),
  })
  .strict();

/** channel → uid registry backing GCal watch webhook authentication. */
export const channelRegistrySchema = z
  .object({
    channelId: z.string(),
    resourceId: z.string(),
    channelToken: z.string(),
    uid: z.string(),
    calendarId: z.string(),
    expiration: z.string(),
  })
  .strict();

export type FieldMeta = z.infer<typeof fieldMetaSchema>;
export type Tombstone = z.infer<typeof tombstoneSchema>;
export type ChannelRegistration = z.infer<typeof channelRegistrySchema>;

/**
 * What a client-facing mutation reports: the sync-counter value its own write produced, or null
 * when it wrote nothing or could not tell. A server older than this field omits it.
 */
export type SyncReceipt = { syncVersion: number | null };

export function readSyncReceipt(response: unknown): number | null {
  const syncVersion = (response as Partial<SyncReceipt> | null | undefined)?.syncVersion;
  return typeof syncVersion === "number" ? syncVersion : null;
}

export type SyncCursor = {
  reset(version: number | null): void;
  recordOwnWrite(version: number): void;
  shouldRefetch(polledVersion: number): boolean;
};

/**
 * The counter version a client's store is consistent with. Its own writes advance it only while
 * they are contiguous with it, so a version another writer took in between still forces a refetch.
 */
export function createSyncCursor(): SyncCursor {
  let syncedVersion: number | null = null;
  const pendingOwnVersions = new Set<number>();

  const absorbContiguousOwnWrites = () => {
    if (syncedVersion === null) return;
    for (const version of pendingOwnVersions) {
      if (version <= syncedVersion) pendingOwnVersions.delete(version);
    }
    while (pendingOwnVersions.delete(syncedVersion + 1)) syncedVersion += 1;
  };

  return {
    reset(version) {
      syncedVersion = version;
      pendingOwnVersions.clear();
    },
    recordOwnWrite(version) {
      if (syncedVersion === null || version <= syncedVersion) return;
      pendingOwnVersions.add(version);
      absorbContiguousOwnWrites();
    },
    shouldRefetch(polledVersion) {
      if (syncedVersion !== null && polledVersion <= syncedVersion) return false;
      syncedVersion = polledVersion;
      absorbContiguousOwnWrites();
      return true;
    },
  };
}
