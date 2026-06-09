const KEY = "vega.anthropicKey";
const MODEL = "vega.anthropicModel";

export const AGENT_MODELS = [
  { id: "claude-opus-4-8", label: "Opus 4.8 — smartest" },
  { id: "claude-haiku-4-5", label: "Haiku 4.5 — fastest" },
] as const;

export const DEFAULT_MODEL = AGENT_MODELS[0].id;

export function getAnthropicKey(): string {
  try { return localStorage.getItem(KEY) ?? ""; } catch { return ""; }
}
export function setAnthropicKey(v: string) {
  try { v ? localStorage.setItem(KEY, v) : localStorage.removeItem(KEY); } catch { /* ignore */ }
}
export function getAgentModel(): string {
  try { return localStorage.getItem(MODEL) ?? DEFAULT_MODEL; } catch { return DEFAULT_MODEL; }
}
export function setAgentModel(v: string) {
  try { localStorage.setItem(MODEL, v); } catch { /* ignore */ }
}
