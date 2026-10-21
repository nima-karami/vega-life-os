import { z } from "zod";

/**
 * The user-level profile doc at `users/{uid}`: identity plus the cloud-mirrored
 * Google-Calendar and nudge-acknowledgement config that follows the
 * account across devices.
 * All fields optional — writes are merge patches and the server stamps `updatedAt`.
 * (Domain records live in `users/{uid}/{collection}` subcollections, not here.)
 */
export const profilePatchSchema = z
  .object({
    name: z.string(),
    workspace: z.string(),
    avatar: z.string(),
    partnerName: z.string(),
    gcalConfigured: z.boolean(),
    gcalEnabled: z.boolean(),
    gcalWriteCalendarId: z.string().nullable(),
    gcalReadCalendarIds: z.array(z.string()),
    gcalShowEvents: z.boolean(),
    gratitudeNudgeAckedThrough: z.iso.date().nullable(),
  })
  .partial();

export type ProfilePatch = z.infer<typeof profilePatchSchema>;
