export type StoredRecord = Record<string, unknown> & {
  updatedAt?: string;
  fieldUpdatedAt?: Record<string, string>;
};

export type FieldLwwResult = {
  merged: Record<string, unknown> & { updatedAt: string };
  fieldUpdatedAt: Record<string, string>;
  /** Whether the stored record actually moved — a replayed identical write reports `false`. */
  changed: boolean;
};

const META_KEYS = new Set(["updatedAt", "fieldUpdatedAt"]);

/**
 * Whole-record write with per-field change stamps — NOT a server-side per-field merge. `merged`
 * is the incoming record verbatim; the server never cherry-picks stored fields. `fieldUpdatedAt`
 * and `updatedAt` are re-stamped only on a real value change, as bookkeeping the client consumes
 * for its own field-level LWW. An identical whole-record write is a no-op, which keeps a replayed
 * set-by-id upsert idempotent.
 */
export function mergeWithFieldLww(
  stored: StoredRecord | null,
  incoming: Record<string, unknown>,
  now: string,
): FieldLwwResult {
  const incomingFields = stripMeta(incoming);
  const priorFields = stored ? stripMeta(stored) : {};
  const fieldUpdatedAt: Record<string, string> = { ...(stored?.fieldUpdatedAt ?? {}) };

  // The write is whole-record, so a key the incoming record no longer carries is dropped — that
  // counts as a change even though no incoming key differs.
  const dropsField = Object.keys(priorFields).some((key) => !(key in incomingFields));
  let hasChange = stored === null || dropsField;
  for (const key of Object.keys(incomingFields)) {
    if (!isSameValue(incomingFields[key], priorFields[key])) {
      fieldUpdatedAt[key] = now;
      hasChange = true;
    }
  }

  const updatedAt = hasChange ? now : (stored?.updatedAt ?? now);
  return { merged: { ...incomingFields, updatedAt }, fieldUpdatedAt, changed: hasChange };
}

function stripMeta(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !META_KEYS.has(key)));
}

function isSameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
