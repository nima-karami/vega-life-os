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
