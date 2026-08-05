export interface DedupeSubject {
  txnDate: string;
  accountSlug: string;
  amountCents: number;
  description: string;
}

export interface DedupeAssignment {
  baseKey: string;
  key: string;
  isDuplicate: boolean;
}

const KEY_LENGTH = 16;

export const toHex = (digest: ArrayBuffer) =>
  Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");

/** `sha256(txnDate | accountSlug | amountCents | description)`, truncated to 16 hex chars. */
export async function computeDedupeBaseKey(subject: DedupeSubject): Promise<string> {
  const payload = [
    subject.txnDate,
    subject.accountSlug,
    String(subject.amountCents),
    subject.description,
  ].join("|");
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(payload));
  return toHex(digest).slice(0, KEY_LENGTH);
}

/**
 * Occurrence index is scoped to the whole batch, not to a file: two identical purchases
 * split across two files of one import must still key `:0` and `:1`, or the second is
 * dropped as a duplicate of the first. `isDuplicate` then reconciles against what is
 * already stored, so a re-import of the same rows produces the same keys and inserts none.
 */
export async function assignDedupeKeys(
  subjects: readonly DedupeSubject[],
  existingKeys: ReadonlySet<string>,
): Promise<DedupeAssignment[]> {
  const baseKeys = await Promise.all(subjects.map(computeDedupeBaseKey));
  const seen = new Map<string, number>();
  return baseKeys.map((baseKey) => {
    const occurrence = seen.get(baseKey) ?? 0;
    seen.set(baseKey, occurrence + 1);
    const key = `${baseKey}:${occurrence}`;
    return { baseKey, key, isDuplicate: existingKeys.has(key) };
  });
}
