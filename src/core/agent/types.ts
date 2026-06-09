import type { IconName } from "@/core/lib/icon-names";

export interface AgentAction {
  id: string;
  label: string;
  icon: IconName;
  hint?: string;
  run: () => void;
}

/** What an agent returns for a query: clickable actions and/or a prose reply. */
export interface AgentResult {
  actions: AgentAction[];
  /** A short natural-language reply (for "what should I…" / "summarize…" queries). */
  message?: string;
}

export interface Agent {
  id: string;
  /** Interpret a free-text query; resolve to ranked actions + optional reply. */
  suggest(query: string): Promise<AgentResult>;
}
