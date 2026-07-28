import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createCommitScheduler } from "./commit-scheduler";

const DEBOUNCE_MS = 600;
const CAP_MS = 1000;

function buildScheduler(debounceMs = DEBOUNCE_MS, initialValue = "") {
  const emit = vi.fn();
  const setSaving = vi.fn();
  const scheduler = createCommitScheduler({
    initialValue,
    debounceMs,
    debounceCapMs: CAP_MS,
    emit,
    setSaving,
  });
  return { scheduler, emit, setSaving };
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

describe("createCommitScheduler (debounced path)", () => {
  it("commits the latest value once the idle window elapses", () => {
    const { scheduler, emit } = buildScheduler();
    scheduler.queueSave("a");
    scheduler.queueSave("ab");
    vi.advanceTimersByTime(DEBOUNCE_MS - 1);
    expect(emit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(emit).toHaveBeenCalledExactlyOnceWith("ab");
  });

  it("reports saving while a commit is pending and idle once it lands", () => {
    const { scheduler, setSaving } = buildScheduler();
    scheduler.queueSave("a");
    expect(setSaving).toHaveBeenCalledWith(true);
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(setSaving).toHaveBeenLastCalledWith(false);
  });

  it("commits at the cap while typing keeps resetting the idle window", () => {
    const { scheduler, emit } = buildScheduler();
    scheduler.queueSave("a");
    vi.advanceTimersByTime(500);
    scheduler.queueSave("ab");
    expect(emit).not.toHaveBeenCalled();
    vi.advanceTimersByTime(500);
    expect(emit).toHaveBeenCalledExactlyOnceWith("ab");
    vi.advanceTimersByTime(CAP_MS);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it("commits a pending value on flush and cancels the timers behind it", () => {
    const { scheduler, emit, setSaving } = buildScheduler();
    scheduler.queueSave("a");
    scheduler.flush();
    expect(emit).toHaveBeenCalledExactlyOnceWith("a");
    expect(setSaving).toHaveBeenLastCalledWith(false);
    vi.advanceTimersByTime(CAP_MS);
    expect(emit).toHaveBeenCalledTimes(1);
  });

  it("flushing with nothing pending only reports idle", () => {
    const { scheduler, emit, setSaving } = buildScheduler();
    scheduler.flush();
    expect(emit).not.toHaveBeenCalled();
    expect(setSaving).toHaveBeenCalledExactlyOnceWith(false);
  });
});

describe("createCommitScheduler (immediate path)", () => {
  it("commits every change synchronously and leaves nothing pending", () => {
    const { scheduler, emit, setSaving } = buildScheduler(0);
    scheduler.queueSave("a");
    scheduler.queueSave("ab");
    expect(emit.mock.calls).toEqual([["a"], ["ab"]]);
    expect(setSaving).not.toHaveBeenCalled();
    scheduler.flush();
    vi.advanceTimersByTime(CAP_MS);
    expect(emit).toHaveBeenCalledTimes(2);
  });
});

describe("createCommitScheduler (external value guard)", () => {
  it("ignores the initial value and a value it committed itself", () => {
    const { scheduler } = buildScheduler(0, "seed");
    expect(scheduler.adoptExternalValue("seed")).toBe(false);
    scheduler.queueSave("typed");
    expect(scheduler.adoptExternalValue("typed")).toBe(false);
  });

  it("adopts a genuinely external value", () => {
    const { scheduler } = buildScheduler(0, "seed");
    expect(scheduler.adoptExternalValue("loaded elsewhere")).toBe(true);
  });

  it("refuses to overwrite an edit that has not been committed yet", () => {
    const { scheduler } = buildScheduler();
    scheduler.queueSave("typed");
    expect(scheduler.adoptExternalValue("loaded elsewhere")).toBe(false);
    vi.advanceTimersByTime(DEBOUNCE_MS);
    expect(scheduler.adoptExternalValue("loaded again")).toBe(true);
  });
});
