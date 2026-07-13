import { afterEach, describe, expect, it, vi } from "vitest";
import { startPolling } from "../poll";

afterEach(() => vi.useRealTimers());

describe("startPolling", () => {
  it("runs immediately and on each interval while visible", () => {
    vi.useFakeTimers();
    const run = vi.fn();
    const stop = startPolling(run, { intervalMs: 1000, isVisible: () => true });
    expect(run).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(2500);
    expect(run).toHaveBeenCalledTimes(3);
    stop();
    vi.advanceTimersByTime(2000);
    expect(run).toHaveBeenCalledTimes(3);
  });
  it("skips ticks while hidden", () => {
    vi.useFakeTimers();
    const run = vi.fn();
    let visible = false;
    startPolling(run, { intervalMs: 1000, isVisible: () => visible });
    run.mockClear(); // ignore the immediate call
    vi.advanceTimersByTime(2000);
    expect(run).not.toHaveBeenCalled();
    visible = true;
    vi.advanceTimersByTime(1000);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
