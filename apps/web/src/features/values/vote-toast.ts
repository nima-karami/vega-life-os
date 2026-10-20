import type { Value } from "./model";

export const VOTE_DESC_MAX = 120;

export function formatVoteMessage(value: Pick<Value, "name" | "desc">): string {
  const desc = value.desc.trim();
  if (desc === "") return `A vote for ${value.name}.`;
  const shown = desc.length > VOTE_DESC_MAX ? `${desc.slice(0, VOTE_DESC_MAX)}…` : desc;
  return `A vote for ${value.name} — “${shown}”`;
}

export function claimVoteToast(seen: Set<string>, valueId: string, date: string): boolean {
  const key = `${valueId}@${date}`;
  if (seen.has(key)) return false;
  seen.add(key);
  return true;
}
