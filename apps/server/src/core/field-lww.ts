export type StoredRecord = Record<string, unknown> & {
  updatedAt?: string;
  fieldUpdatedAt?: Record<string, string>;
};

export type FieldLwwResult = {
  merged: Record<string, unknown> & { updatedAt: string };
  fieldUpdatedAt: Record<string, string>;
};

const META_KEYS = new Set(["updatedAt", "fieldUpdatedAt"]);

/**
 * Server-computed field LWW: diff the incoming WHOLE record against the stored one,
 * re-stamping `fieldUpdatedAt[field] = now` only where a value actually changed and
 * bumping `updatedAt` only on a real change. An identical whole-record write is a no-op,
 * which is what makes a replayed set-by-id upsert idempotent.
 */
export function mergeWithFieldLww(
  stored: StoredRecord | null,
  incoming: Record<string, unknown>,
  now: string,
): FieldLwwResult {
  const data = stripMeta(incoming);
  const priorData = stored ? stripMeta(stored) : {};
  const fieldUpdatedAt: Record<string, string> = { ...(stored?.fieldUpdatedAt ?? {}) };

  let hasChange = stored === null;
  for (const key of Object.keys(data)) {
    if (!isSameValue(data[key], priorData[key])) {
      fieldUpdatedAt[key] = now;
      hasChange = true;
    }
  }

  const updatedAt = hasChange ? now : (stored?.updatedAt ?? now);
  return { merged: { ...data, updatedAt }, fieldUpdatedAt };
}

function stripMeta(record: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(record).filter(([key]) => !META_KEYS.has(key)));
}

function isSameValue(a: unknown, b: unknown): boolean {
  return JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
}
