import { describe, expect, it } from "vitest";
import { describeSyncFailure } from "../sync-feedback";

describe("describeSyncFailure", () => {
  it("maps backing_off to a rate-limit message", () => {
    expect(describeSyncFailure("backing_off")).toMatch(/rate-limit/i);
  });
  it("maps locked to an in-progress message", () => {
    expect(describeSyncFailure("locked")).toMatch(/already running/i);
  });
  it("maps needs_reauth to a reconnect prompt", () => {
    expect(describeSyncFailure("needs_reauth")).toMatch(/reconnect/i);
  });
  it("maps write_calendar_missing to a banner recreate prompt", () => {
    expect(describeSyncFailure("write_calendar_missing")).toMatch(/banner/i);
  });
  it("falls back to a generic message for an unknown reason", () => {
    expect(describeSyncFailure(undefined)).toMatch(/try again/i);
  });
});
