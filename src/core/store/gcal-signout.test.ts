import { beforeEach, describe, expect, it, vi } from "vitest";

const { clearAll, dexieClear, clearCalendarToken } = vi.hoisted(() => ({
  clearAll: vi.fn(async () => {}),
  dexieClear: vi.fn(async () => {}),
  clearCalendarToken: vi.fn(),
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
vi.mock("./persist", () => ({ setPersistAuth: vi.fn(), setPersist: vi.fn() }));
vi.mock("@/features/calendar-sync/google-auth", () => ({ clearCalendarToken }));

import { defaultGcalConfig } from "@/features/calendar-sync/config";
import { useStore } from "./store";

describe("sign-out tears down the Google Calendar connection", () => {
  beforeEach(() => {
    clearCalendarToken.mockClear();
    useStore.setState({
      authUid: "u1",
      authResolved: true,
      gcal: {
        enabled: true,
        writeCalendarId: "cal_vega",
        readCalendarIds: ["primary"],
        showGoogleEvents: false,
      },
    });
  });

  it("resets the gcal slice to defaults and clears the device token", async () => {
    await useStore.getState().onAuthChange(null);
    expect(useStore.getState().gcal).toEqual(defaultGcalConfig());
    expect(clearCalendarToken).toHaveBeenCalledOnce();
  });
});
