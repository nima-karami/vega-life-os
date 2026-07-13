import { describe, expect, it } from "vitest";
import { channelRegistrySchema, fieldMetaSchema, tombstoneSchema } from "../sync";

describe("sync-support schemas", () => {
  it("accepts a tombstone and rejects an unknown collection", () => {
    expect(
      tombstoneSchema.safeParse({
        id: "t_1",
        collection: "tasks",
        deletedAt: "2026-07-13T10:00:00.000Z",
      }).success,
    ).toBe(true);
    expect(
      tombstoneSchema.safeParse({
        id: "t_1",
        collection: "bogus",
        deletedAt: "2026-07-13T10:00:00.000Z",
      }).success,
    ).toBe(false);
  });

  it("rejects an unknown field on a channel registration", () => {
    const registration = {
      channelId: "c_1",
      resourceId: "res_1",
      channelToken: "tok_1",
      uid: "u_1",
      calendarId: "primary",
      expiration: "2026-07-20T10:00:00.000Z",
    };
    expect(channelRegistrySchema.safeParse(registration).success).toBe(true);
    expect(channelRegistrySchema.safeParse({ ...registration, bogus: 1 }).success).toBe(false);
  });

  it("treats field meta as a string→string map", () => {
    expect(fieldMetaSchema.safeParse({ title: "2026-07-13T10:00:00.000Z" }).success).toBe(true);
    expect(fieldMetaSchema.safeParse({ title: 5 }).success).toBe(false);
  });
});
