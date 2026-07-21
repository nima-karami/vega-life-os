import { beforeEach, describe, expect, it, vi } from "vitest";

const { clearAll, dexieClear } = vi.hoisted(() => ({
  clearAll: vi.fn(async () => {}),
  dexieClear: vi.fn(async () => {}),
}));

vi.mock("@/core/persistence", async (orig) => {
  const actual = await orig<typeof import("@/core/persistence")>();
  return {
    ...actual,
    persistence: {
      ...actual.persistence,
      clearAll,
      bulkPut: vi.fn(async () => {}),
      setDelegate: vi.fn(),
    },
    DexieAdapter: class {
      clearAll = dexieClear;
      isEmpty = vi.fn(async () => true);
    },
  };
});
vi.mock("@/core/persistence/sandbox-meta", () => ({
  setSandboxDirty: vi.fn(async () => {}),
  getSandboxDirty: vi.fn(async () => false),
  isSandboxDirty: () => false,
}));
vi.mock("./persist", () => ({ setPersistAuth: vi.fn(), bindPersistStore: vi.fn() }));

import { useStore } from "./store";

describe("sign-out tears down the Google Calendar connection", () => {
  beforeEach(() => {
    useStore.setState({
      authUid: "u1",
      authResolved: true,
      showGoogleEvents: false,
      gcalStatus: {
        connected: true,
        needsReauth: false,
        writeCalendarMissing: false,
        writeCalendarId: "cal_vega",
        readCalendarIds: ["primary"],
        calendarPrefs: {},
        lastSyncedAt: null,
        backoffUntil: null,
        timeZone: null,
      },
    });
  });

  it("clears the account's gcal status and resets the display pref", async () => {
    await useStore.getState().onAuthChange(null);
    expect(useStore.getState().gcalStatus).toBeNull();
    expect(useStore.getState().showGoogleEvents).toBe(true);
  });
});
