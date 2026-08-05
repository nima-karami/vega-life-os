/** Card side of a card-payment pair. */
const CARD_SIDE = [/\bPAYMENT\b[\s-]*\bTHANK\s*YOU\b/i, /\bPAIEMENT\b/i];

/** Bank side: the trailing digits are the masked account, so these match the raw description. */
const BANK_SIDE = [
  /\bONLINE\s+BANKING\s+(?:PAYMENT|TRANSFER)\b/i,
  /\bONLINE\s+TRANSFER\s+TO\s+DEPOSIT\s+ACCOUNT\b/i,
  /\bONLINE\s+TRANSFER\s+(?:SENT|RECEIVED)\b/i,
];

const ISSUER_CREDIT = /\bROYAL\s+BANK\s+OF\s+CANADA\b/i;

export interface InternalTransferSubject {
  description: string;
  amountCents: number;
}

/**
 * Flags a row as one leg of a move between the owner's own accounts. It never deletes,
 * and the two legs are matched independently — statement close dates differ per account,
 * so they legitimately do not net to zero.
 */
export function detectInternalTransfer({
  description,
  amountCents,
}: InternalTransferSubject): boolean {
  if (CARD_SIDE.some((pattern) => pattern.test(description))) return true;
  if (BANK_SIDE.some((pattern) => pattern.test(description))) return true;
  return amountCents > 0 && ISSUER_CREDIT.test(description);
}
