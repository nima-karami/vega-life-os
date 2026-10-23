type Row = { id: string; updatedAt?: string };

function isSameValue(left: unknown, right: unknown): boolean {
  if (Object.is(left, right)) return true;
  if (typeof left !== "object" || typeof right !== "object" || left === null || right === null)
    return false;
  if (Array.isArray(left) !== Array.isArray(right)) return false;
  const leftKeys = Object.keys(left);
  if (leftKeys.length !== Object.keys(right).length) return false;
  return leftKeys.every(
    (key) =>
      Object.hasOwn(right, key) &&
      isSameValue((left as Record<string, unknown>)[key], (right as Record<string, unknown>)[key]),
  );
}

function isSameRow(prevRow: Row, nextRow: Row): boolean {
  if (prevRow.updatedAt !== nextRow.updatedAt) return false;
  return isSameValue(prevRow, nextRow);
}

/**
 * Server truth in `next`, with every row equal to its previous self kept by reference — and the
 * previous array itself when nothing changed — so a refetch re-renders only what it changed.
 */
export function mergeRows<T extends Row>(prev: readonly T[], next: T[]): T[] {
  const prevById = new Map(prev.map((row) => [row.id, row]));
  let isUnchanged = prev.length === next.length;
  const merged = next.map((nextRow, index) => {
    const prevRow = prevById.get(nextRow.id);
    const kept = prevRow && isSameRow(prevRow, nextRow) ? prevRow : nextRow;
    if (kept !== prev[index]) isUnchanged = false;
    return kept;
  });
  return isUnchanged ? (prev as T[]) : merged;
}

/** One stored record (not a collection) gets the same treatment: equal means the same reference. */
export function mergeRecord<T>(prev: T, next: T): T {
  return isSameValue(prev, next) ? prev : next;
}
