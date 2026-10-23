import { describe, expect, it, vi } from "vitest";

const agentModule = vi.hoisted(() => ({ failNextImport: true, instances: 0 }));

vi.mock("./config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./config")>()),
  getAnthropicKey: () => "test-key",
}));
vi.mock("./local-agent", () => ({
  LocalIntentAgent: class {
    suggest = async () => ({ actions: [], message: "local" });
  },
}));
vi.mock("./anthropic-agent", () => {
  if (agentModule.failNextImport) {
    agentModule.failNextImport = false;
    throw new TypeError("Failed to fetch dynamically imported module: anthropic-agent.js");
  }
  return {
    AnthropicAgent: class {
      constructor() {
        agentModule.instances += 1;
      }
      suggest = async () => ({ actions: [], message: "anthropic" });
    },
  };
});

import { runAgent } from "./index";

describe("runAgent with a key", () => {
  it("falls back to the local agent when the SDK chunk fails, then loads it on the next query", async () => {
    expect((await runAgent("plan my week")).message).toBe("local");

    const [first, second] = await Promise.all([runAgent("plan"), runAgent("summarize")]);

    expect([first.message, second.message]).toEqual(["anthropic", "anthropic"]);
    expect((await runAgent("again")).message).toBe("anthropic");
    expect(agentModule.instances).toBe(1);
  });
});
