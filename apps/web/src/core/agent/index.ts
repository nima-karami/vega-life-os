export { AnthropicAgent } from "./anthropic-agent";
export * from "./config";
export { LocalIntentAgent } from "./local-agent";
export type { Agent, AgentAction, AgentResult } from "./types";
export { parseWhen } from "./when";

import { AnthropicAgent } from "./anthropic-agent";
import { getAnthropicKey } from "./config";
import { LocalIntentAgent } from "./local-agent";
import type { AgentResult } from "./types";

const local = new LocalIntentAgent();
const anthropic = new AnthropicAgent();

/**
 * Run the best available agent for a query. With a key configured, Claude
 * interprets; the local regex agent is the offline / no-key fallback (and a
 * safety net if the API call throws).
 */
export async function runAgent(query: string): Promise<AgentResult> {
  if (getAnthropicKey()) {
    try {
      return await anthropic.suggest(query);
    } catch {
      return local.suggest(query);
    }
  }
  return local.suggest(query);
}
