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

/** A repeat is a vote for a value whose message is still on screen: brief, no identity line. */
export function buildVoteMessage(
  value: Pick<Value, "name" | "identity">,
  isRepeat = false,
): VoteMessage {
  const headline = `${isRepeat ? "Another vote" : "A vote"} for ${value.name}`;
  const identity = isRepeat ? null : value.identity.trim() || null;
  const announcement = identity
    ? `Done. ${headline}. ${closeSentence(identity)}`
    : `Done. ${headline}.`;
  return { headline, identity, announcement };
}
