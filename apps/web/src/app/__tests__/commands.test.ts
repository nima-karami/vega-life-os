import { afterEach, describe, expect, it, vi } from "vitest";
import {
  type ActionCommand,
  getRegistryVersion,
  getViewCommands,
  registerCommands,
} from "../commands";

// Reset the module-level registry state between tests by calling unregister fns
afterEach(() => {
  // Clear all registered view commands by unregistering anything left
  const cmds = getViewCommands();
  if (cmds.length > 0) {
    // Re-register then immediately unregister to clear
    const unregister = registerCommands(cmds);
    unregister();
  }
});

function makeCmd(id: string): ActionCommand {
  return { id, label: id, icon: "plus", run: vi.fn() };
}

describe("registerCommands", () => {
  it("registers commands and makes them visible via getViewCommands", () => {
    const unregister = registerCommands([makeCmd("test-a"), makeCmd("test-b")]);
    const cmds = getViewCommands();
    expect(cmds.map((c) => c.id)).toContain("test-a");
    expect(cmds.map((c) => c.id)).toContain("test-b");
    unregister();
  });

  it("unregister removes the commands", () => {
    const unregister = registerCommands([makeCmd("test-c")]);
    expect(getViewCommands().map((c) => c.id)).toContain("test-c");
    unregister();
    expect(getViewCommands().map((c) => c.id)).not.toContain("test-c");
  });

  it("registering a duplicate id replaces the old command", () => {
    const unregA = registerCommands([{ ...makeCmd("dup-id"), label: "old" }]);
    const unregB = registerCommands([{ ...makeCmd("dup-id"), label: "new" }]);
    const cmds = getViewCommands();
    const found = cmds.filter((c) => c.id === "dup-id");
    expect(found).toHaveLength(1);
    expect(found[0].label).toBe("new");
    unregA();
    unregB();
  });

  it("unregister leaves no residue after multiple register/unregister cycles", () => {
    const unregister = registerCommands([makeCmd("cycle-a")]);
    unregister();
    const unregister2 = registerCommands([makeCmd("cycle-b")]);
    unregister2();
    const ids = getViewCommands().map((c) => c.id);
    expect(ids).not.toContain("cycle-a");
    expect(ids).not.toContain("cycle-b");
  });

  it("bumps the registry version on register", () => {
    const before = getRegistryVersion();
    const unregister = registerCommands([makeCmd("version-test")]);
    const after = getRegistryVersion();
    expect(after).toBeGreaterThan(before);
    unregister();
  });

  it("bumps the registry version on unregister", () => {
    const unregister = registerCommands([makeCmd("version-test-2")]);
    const before = getRegistryVersion();
    unregister();
    const after = getRegistryVersion();
    expect(after).toBeGreaterThan(before);
  });

  it("multiple simultaneous registrations coexist", () => {
    const unregA = registerCommands([makeCmd("multi-a")]);
    const unregB = registerCommands([makeCmd("multi-b")]);
    const ids = getViewCommands().map((c) => c.id);
    expect(ids).toContain("multi-a");
    expect(ids).toContain("multi-b");
    unregA();
    expect(getViewCommands().map((c) => c.id)).not.toContain("multi-a");
    expect(getViewCommands().map((c) => c.id)).toContain("multi-b");
    unregB();
  });
});
