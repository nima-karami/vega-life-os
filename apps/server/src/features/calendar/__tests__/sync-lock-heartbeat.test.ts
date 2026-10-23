import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { startIntervalHeartbeat } from "../sync-lock";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("startIntervalHeartbeat", () => {
  it("renews once per interval until stopped", async () => {
    const renew = vi.fn(async () => {});
    const stop = startIntervalHeartbeat(renew, 10_000);

    await vi.advanceTimersByTimeAsync(9_999);
    expect(renew).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(1);
    expect(renew).toHaveBeenCalledTimes(1);
    await vi.advanceTimersByTimeAsync(20_000);
    expect(renew).toHaveBeenCalledTimes(3);

    stop();
    await vi.advanceTimersByTimeAsync(60_000);
    expect(renew).toHaveBeenCalledTimes(3);
  });

  it("swallows a failed renewal and keeps beating", async () => {
    const unhandled: unknown[] = [];
    const recordUnhandled = (reason: unknown) => unhandled.push(reason);
    process.on("unhandledRejection", recordUnhandled);
    // A plain function, not vi.fn: a mock attaches its own handler to every promise it returns.
    let renewals = 0;
    const renew = async () => {
      renewals += 1;
      throw new Error("Transaction lock timeout");
    };
    const stop = startIntervalHeartbeat(renew, 1_000);
    await vi.advanceTimersByTimeAsync(3_000);
    stop();
    vi.useRealTimers();
    await new Promise((resolve) => setTimeout(resolve, 10));
    process.off("unhandledRejection", recordUnhandled);

    expect(renewals).toBe(3);
    expect(unhandled).toEqual([]);
  });

  it("never holds the process open", () => {
    const setIntervalSpy = vi.spyOn(globalThis, "setInterval");
    const stop = startIntervalHeartbeat(async () => {}, 1_000);
    const timer = setIntervalSpy.mock.results[0]?.value as NodeJS.Timeout;
    expect(timer.hasRef()).toBe(false);
    stop();
  });
});
