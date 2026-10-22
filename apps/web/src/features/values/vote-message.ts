import type { Value } from "./model";

export interface VoteMessage {
  headline: string;
  identity: string | null;
  announcement: string;
}

const CLOSING_PUNCTUATION = /[.!?…]$/;

function closeSentence(text: string): string {
  return CLOSING_PUNCTUATION.test(text) ? text : `${text}.`;
}

export function buildVoteMessage(value: Pick<Value, "name" | "identity">): VoteMessage {
  const headline = `A vote for ${value.name}`;
  const identity = value.identity.trim() || null;
  const announcement = identity
    ? `Done. ${headline}. ${closeSentence(identity)}`
    : `Done. ${headline}.`;
  return { headline, identity, announcement };
}
