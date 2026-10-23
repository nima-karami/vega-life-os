export * from "./config";
export { LocalIntentAgent } from "./local-agent";
export type { Agent, AgentAction, AgentResult } from "./types";
export { parseWhen } from "./when";

import { getAnthropicKey } from "./config";
import { LocalIntentAgent } from "./local-agent";
import type { Agent, AgentResult } from "./types";

const local = new LocalIntentAgent();
let anthropic: Promise<Agent> | undefined;

// The SDK loads only once a key exists.
function loadAnthropicAgent(): Promise<Agent> {
  anthropic ??= import("./anthropic-agent").then(
    ({ AnthropicAgent }) => new AnthropicAgent(),
    (error: unknown) => {
      anthropic = undefined;
      throw error;
    },
  );
  return anthropic;
}

/**
 * Run the best available agent for a query. With a key configured, Claude
 * interprets; the local regex agent is the offline / no-key fallback (and a
 * safety net if the API call or its lazy load throws).
 */
export async function runAgent(query: string): Promise<AgentResult> {
  if (getAnthropicKey()) {
    try {
      const anthropicAgent = await loadAnthropicAgent();
      return await anthropicAgent.suggest(query);
    } catch {
      return local.suggest(query);
    }
  }
  return local.suggest(query);
}
