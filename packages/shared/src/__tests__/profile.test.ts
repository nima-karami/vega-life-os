import { describe, expect, it } from "vitest";
import { profilePatchSchema } from "../profile";

describe("profilePatchSchema gratitude-nudge watermark", () => {
  it("accepts an ISO date or null", () => {
    expect(profilePatchSchema.safeParse({ gratitudeNudgeAckedThrough: "2026-06-24" }).success).toBe(
      true,
    );
    expect(profilePatchSchema.safeParse({ gratitudeNudgeAckedThrough: null }).success).toBe(true);
  });

  it("rejects anything that is not a calendar date", () => {
    for (const bad of ["yesterday", "2026-6-24", "2026-06-24T00:00:00Z", "2026-02-30"])
      expect(profilePatchSchema.safeParse({ gratitudeNudgeAckedThrough: bad }).success).toBe(false);
  });
});

describe("profilePatchSchema quiet mode", () => {
  it("accepts a boolean and rejects anything else", () => {
    expect(profilePatchSchema.safeParse({ quietMode: false }).success).toBe(true);
    expect(profilePatchSchema.safeParse({ quietMode: true }).success).toBe(true);
    expect(profilePatchSchema.safeParse({ quietMode: "off" }).success).toBe(false);
  });
});
