import { beforeEach, describe, expect, it, vi } from "vitest";

const { metaPut } = vi.hoisted(() => ({
  metaPut: vi.fn(async (_row: { key: string; dirty: boolean }) => "sandbox"),
}));
vi.mock("../db", () => ({ db: { meta: { put: metaPut, get: vi.fn() } } }));

beforeEach(() => {
  vi.resetModules();
  metaPut.mockReset();
  metaPut.mockResolvedValue("sandbox");
});

const loadSandboxMeta = () => import("../sandbox-meta");

const SANDBOX_META_CHANNEL = "vega.sandbox-meta";

describe("setSandboxDirty", () => {
  it("writes the flag once per transition, not once per save", async () => {
    const { setSandboxDirty } = await loadSandboxMeta();
    await setSandboxDirty(true);
    await setSandboxDirty(true);
    await setSandboxDirty(true);
    expect(metaPut).toHaveBeenCalledTimes(1);
  });

  it("writes again after a reset cleans the sandbox", async () => {
    const { setSandboxDirty } = await loadSandboxMeta();
    await setSandboxDirty(true);
    await setSandboxDirty(false);
    await setSandboxDirty(true);
    expect(metaPut.mock.calls.map(([row]) => row)).toEqual([
      { key: "sandbox", dirty: true },
      { key: "sandbox", dirty: false },
      { key: "sandbox", dirty: true },
    ]);
  });

  it("writes again after another tab rewrote the flag", async () => {
    const { setSandboxDirty } = await loadSandboxMeta();
    await setSandboxDirty(true);
    const otherTab = new BroadcastChannel(SANDBOX_META_CHANNEL);
    otherTab.postMessage("sandbox-meta-written");
    otherTab.close();
    await vi.waitFor(async () => {
      await setSandboxDirty(true);
      expect(metaPut).toHaveBeenCalledTimes(2);
    });
  });

  it("tells other tabs when it writes the flag", async () => {
    const { setSandboxDirty } = await loadSandboxMeta();
    const otherTab = new BroadcastChannel(SANDBOX_META_CHANNEL);
    const received: unknown[] = [];
    otherTab.onmessage = (event) => received.push(event.data);
    await setSandboxDirty(false);
    await vi.waitFor(() => expect(received).toHaveLength(1));
    otherTab.close();
  });

  it("retries a write that failed", async () => {
    const { setSandboxDirty } = await loadSandboxMeta();
    metaPut.mockRejectedValueOnce(new Error("quota"));
    await setSandboxDirty(true);
    await setSandboxDirty(true);
    expect(metaPut).toHaveBeenCalledTimes(2);
  });
});
