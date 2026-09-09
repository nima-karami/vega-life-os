import { describe, expect, it, vi } from "vitest";
import { RELOAD_FALLBACK_MS, type ReloadPorts, reloadWhenActivated } from "../pwa-reload";

function ports() {
  const listeners: (() => void)[] = [];
  const timers: { ms: number; run: () => void }[] = [];
  const reload = vi.fn();
  const spec: ReloadPorts = {
    onControllerChange: (run) => listeners.push(run),
    after: (ms, run) => timers.push({ ms, run }),
    reload,
  };
  return {
    spec,
    reload,
    controllerChanged: () => {
      for (const run of listeners) run();
    },
    timers,
  };
}

const settled = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("reloadWhenActivated", () => {
  it("reloads as soon as the new worker takes control", async () => {
    const p = ports();
    reloadWhenActivated(Promise.resolve(), p.spec);
    p.controllerChanged();
    expect(p.reload).toHaveBeenCalledTimes(1);
  });

  it("reloads anyway when the controller never changes — the dead-end this fixes", async () => {
    const p = ports();
    reloadWhenActivated(Promise.resolve(), p.spec);
    await settled();
    expect(p.reload).not.toHaveBeenCalled();
    expect(p.timers[0].ms).toBe(RELOAD_FALLBACK_MS);
    p.timers[0].run();
    expect(p.reload).toHaveBeenCalledTimes(1);
  });

  it("reloads once when both signals arrive", async () => {
    const p = ports();
    reloadWhenActivated(Promise.resolve(), p.spec);
    p.controllerChanged();
    await settled();
    p.timers[0].run();
    expect(p.reload).toHaveBeenCalledTimes(1);
  });

  it("still reloads when messaging the waiting worker rejects", async () => {
    const p = ports();
    reloadWhenActivated(Promise.reject(new Error("no waiting worker")), p.spec);
    await settled();
    p.timers[0].run();
    expect(p.reload).toHaveBeenCalledTimes(1);
  });
});
