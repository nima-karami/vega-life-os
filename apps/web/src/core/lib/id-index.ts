type Row = { id: string };

// Store arrays are replaced, never mutated, so an index keyed by the array cannot go stale.
const indexByRows = new WeakMap<readonly Row[], Map<string, Row>>();

function buildIdIndex(rows: readonly Row[]): Map<string, Row> {
  const index = new Map<string, Row>();
  for (const row of rows) if (!index.has(row.id)) index.set(row.id, row);
  return index;
}

/** `rows.find((row) => row.id === id)`, from an index built once per array. */
export function findById<T extends Row>(rows: readonly T[], id: string | null | undefined) {
  if (id == null) return undefined;
  let index = indexByRows.get(rows);
  if (!index) {
    index = buildIdIndex(rows);
    indexByRows.set(rows, index);
  }
  return index.get(id) as T | undefined;
}
