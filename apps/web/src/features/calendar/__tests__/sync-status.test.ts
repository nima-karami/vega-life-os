import { describe, expect, it } from "vitest";
import type { GcalStatus } from "@/features/calendar-sync";
import { deriveSyncPhase, formatLastSynced, formatSyncStatus } from "../sync-status";

const NOW = "2026-07-20T12:00:00.000Z";
const connected: GcalStatus = {
  connected: true,
  needsReauth: false,
  writeCalendarMissing: false,
  writeCalendarId: "w",
  readCalendarIds: [],
  calendarPrefs: {},
  lastSyncedAt: null,
  backoffUntil: null,
  timeZone: null,
};

describe("deriveSyncPhase", () => {
  it("orders precedence: unknown → busy → missing-calendar → reauth → backoff → error → connected", () => {
    expect(deriveSyncPhase({ status: null, busy: false, error: false, nowIso: NOW })).toBe(
      "unknown",
    );
    expect(deriveSyncPhase({ status: connected, busy: true, error: false, nowIso: NOW })).toBe(
      "syncing",
    );
    expect(
      deriveSyncPhase({
        status: { ...connected, writeCalendarMissing: true },
        busy: false,
        error: false,
        nowIso: NOW,
      }),
    ).toBe("write-calendar-missing");
    expect(
      deriveSyncPhase({
        status: { ...connected, connected: false, needsReauth: true },
        busy: false,
        error: false,
        nowIso: NOW,
      }),
    ).toBe("needs-reconnect");
    expect(
      deriveSyncPhase({
        status: { ...connected, backoffUntil: "2999-01-01T00:00:00.000Z" },
        busy: false,
        error: false,
        nowIso: NOW,
      }),
    ).toBe("backing-off");
    expect(deriveSyncPhase({ status: connected, busy: false, error: true, nowIso: NOW })).toBe(
      "error",
    );
    expect(deriveSyncPhase({ status: connected, busy: false, error: false, nowIso: NOW })).toBe(
      "connected",
    );
    expect(
      deriveSyncPhase({
        status: { ...connected, connected: false },
        busy: false,
        error: false,
        nowIso: NOW,
      }),
    ).toBe("disconnected");
  });

  it("ignores an expired backoff window (in the past)", () => {
    expect(
      deriveSyncPhase({
        status: { ...connected, backoffUntil: "2000-01-01T00:00:00.000Z" },
        busy: false,
        error: false,
        nowIso: NOW,
      }),
    ).toBe("connected");
  });

  it("prefers the missing-calendar pause over a live backoff", () => {
    expect(
      deriveSyncPhase({
        status: {
          ...connected,
          writeCalendarMissing: true,
          backoffUntil: "2999-01-01T00:00:00.000Z",
        },
        busy: false,
        error: false,
        nowIso: NOW,
      }),
    ).toBe("write-calendar-missing");
  });
});

describe("formatLastSynced", () => {
  const now = 1_700_000_000_000;
  it("returns null when never synced", () => {
    expect(formatLastSynced(null, now)).toBeNull();
  });
  it("says 'just now' under a minute", () => {
    expect(formatLastSynced(now - 30_000, now)).toBe("just now");
  });
  it("formats minutes", () => {
    expect(formatLastSynced(now - 2 * 60_000, now)).toBe("2m ago");
    expect(formatLastSynced(now - 1 * 60_000, now)).toBe("1m ago");
  });
  it("formats hours", () => {
    expect(formatLastSynced(now - 3 * 3_600_000, now)).toBe("3h ago");
  });
  it("formats days", () => {
    expect(formatLastSynced(now - 2 * 86_400_000, now)).toBe("2d ago");
  });
});

describe("formatSyncStatus", () => {
  it("maps each phase to human-readable status copy", () => {
    expect(formatSyncStatus("unknown")).toMatch(/checking/i);
    expect(formatSyncStatus("disconnected")).toMatch(/not connected|disconnected/i);
    expect(formatSyncStatus("syncing")).toMatch(/syncing/i);
    expect(formatSyncStatus("backing-off")).toMatch(/retry|paused/i);
    expect(formatSyncStatus("error")).toMatch(/failed|error/i);
    expect(formatSyncStatus("needs-reconnect")).toMatch(/expired|reconnect/i);
    expect(formatSyncStatus("write-calendar-missing")).toMatch(/removed/i);
    expect(formatSyncStatus("connected")).toMatch(/connected|synced/i);
  });
});
