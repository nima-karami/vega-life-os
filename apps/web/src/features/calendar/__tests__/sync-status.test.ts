import { describe, expect, it } from "vitest";
import { deriveSyncPhase, formatLastSynced, formatSyncStatus } from "../sync-status";

describe("deriveSyncPhase", () => {
  it("is 'not-configured' when GCal has no client id, regardless of other flags", () => {
    expect(
      deriveSyncPhase({
        configured: false,
        enabled: true,
        connected: true,
        busy: false,
        error: false,
      }),
    ).toBe("not-configured");
  });

  it("is 'disconnected' when configured but sync is off", () => {
    expect(
      deriveSyncPhase({
        configured: true,
        enabled: false,
        connected: false,
        busy: false,
        error: false,
      }),
    ).toBe("disconnected");
  });

  it("is 'syncing' while a run is in flight (takes precedence over connected)", () => {
    expect(
      deriveSyncPhase({
        configured: true,
        enabled: true,
        connected: true,
        busy: true,
        error: false,
      }),
    ).toBe("syncing");
  });

  it("is 'error' when the last run failed and nothing is in flight", () => {
    expect(
      deriveSyncPhase({
        configured: true,
        enabled: true,
        connected: true,
        busy: false,
        error: true,
      }),
    ).toBe("error");
  });

  it("is 'needs-reconnect' when enabled but the token is gone (auth expired)", () => {
    expect(
      deriveSyncPhase({
        configured: true,
        enabled: true,
        connected: false,
        busy: false,
        error: false,
      }),
    ).toBe("needs-reconnect");
  });

  it("is 'needs-reconnect' (danger) when the engine flags it, over backing-off", () => {
    expect(
      deriveSyncPhase({
        configured: true,
        enabled: true,
        connected: true,
        busy: false,
        error: false,
        needsReconnect: true,
        backingOff: true,
      }),
    ).toBe("needs-reconnect");
  });

  it("is 'backing-off' (calm) on a transient retry, not 'error'", () => {
    expect(
      deriveSyncPhase({
        configured: true,
        enabled: true,
        connected: true,
        busy: false,
        error: false,
        backingOff: true,
      }),
    ).toBe("backing-off");
  });

  it("is 'connected' when enabled, connected, idle and healthy", () => {
    expect(
      deriveSyncPhase({
        configured: true,
        enabled: true,
        connected: true,
        busy: false,
        error: false,
      }),
    ).toBe("connected");
  });

  it("busy wins even when enabled but not yet connected (initial connect)", () => {
    expect(
      deriveSyncPhase({
        configured: true,
        enabled: false,
        connected: false,
        busy: true,
        error: false,
      }),
    ).toBe("syncing");
  });
});

describe("deriveSyncPhase — scope upgrade", () => {
  const base = { configured: true, enabled: true, connected: true, busy: false, error: false };
  it("demands upgraded consent when the stored scope is stale", () => {
    expect(deriveSyncPhase({ ...base, scopeStale: true })).toBe("needs-upgraded-consent");
  });
  it("ignores scopeStale when not connected/enabled", () => {
    expect(deriveSyncPhase({ ...base, enabled: false, connected: false, scopeStale: true })).toBe(
      "disconnected",
    );
  });
  it("busy/error still take precedence over a stale scope", () => {
    expect(deriveSyncPhase({ ...base, busy: true, scopeStale: true })).toBe("syncing");
    expect(deriveSyncPhase({ ...base, error: true, scopeStale: true })).toBe("error");
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
    expect(formatSyncStatus("not-configured")).toMatch(/set up/i);
    expect(formatSyncStatus("disconnected")).toMatch(/not connected|disconnected/i);
    expect(formatSyncStatus("syncing")).toMatch(/syncing/i);
    expect(formatSyncStatus("backing-off")).toMatch(/retry|paused/i);
    expect(formatSyncStatus("error")).toMatch(/failed|error/i);
    expect(formatSyncStatus("needs-reconnect")).toMatch(/expired|reconnect/i);
    expect(formatSyncStatus("connected")).toMatch(/connected|synced/i);
  });
});
