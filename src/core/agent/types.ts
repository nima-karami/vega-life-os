import type { IconName } from "@/core/lib/icon-names";

export interface AgentAction {
  id: string;
  label: string;
  icon: IconName;
  hint?: string;
  run: () => void;
}

export interface Agent {
  id: string;
  /** Return candidate actions for a free-text query (ranked, best first). */
  suggest(query: string): AgentAction[];
}
