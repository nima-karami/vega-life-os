import { z } from "zod";
import { ToolError } from "./tool-result";

const PAGE_BYTE_LIMIT = 256 * 1024;
const DEFAULT_LIMIT = 50;
const MAX_LIMIT = 200;

type Row = { id: string; order?: number };
type QueryOptions = {
  schemaKeys: readonly string[];
  where?: Record<string, string | number | boolean | null>;
  search?: string;
  limit?: number;
  cursor?: string;
};

const sortKeySchema = z.strictObject({ id: z.string(), order: z.number().nullable() });
type SortKey = z.infer<typeof sortKeySchema>;

function getSortKey(row: Row): SortKey {
  return { id: row.id, order: Number.isFinite(row.order) ? (row.order ?? null) : null };
}

function compareKeys(left: SortKey, right: SortKey): number {
  const leftOrder = left.order ?? Infinity;
  const rightOrder = right.order ?? Infinity;
  if (leftOrder !== rightOrder) return leftOrder - rightOrder;
  if (left.id === right.id) return 0;
  return left.id < right.id ? -1 : 1;
}

function encodeCursor(key: SortKey): string {
  return Buffer.from(JSON.stringify(key)).toString("base64url");
}

function decodeCursor(cursor: string): SortKey {
  try {
    const bytes = Buffer.from(cursor, "base64url");
    if (bytes.toString("base64url") === cursor) {
      return sortKeySchema.parse(JSON.parse(bytes.toString("utf8")));
    }
  } catch {
    throw new ToolError("BAD_REQUEST", "invalid cursor");
  }
  throw new ToolError("BAD_REQUEST", "invalid cursor");
}

function getMatchingRows<RowType extends Row>(rows: readonly RowType[], options: QueryOptions) {
  const filters = Object.entries(options.where ?? {});
  for (const [key] of filters) {
    if (!options.schemaKeys.includes(key)) {
      throw new ToolError("BAD_REQUEST", `unknown filter field: ${key}`);
    }
  }

  const search = options.search?.toLowerCase() ?? "";
  const after = options.cursor === undefined ? null : decodeCursor(options.cursor);
  return rows
    .filter((row) => {
      const fields = row as Record<string, unknown>;
      return (
        filters.every(([key, value]) => Object.hasOwn(fields, key) && fields[key] === value) &&
        (!search ||
          Object.values(fields).some(
            (value) => typeof value === "string" && value.toLowerCase().includes(search),
          ))
      );
    })
    .map((row) => ({ row, key: getSortKey(row) }))
    .filter(({ key }) => after === null || compareKeys(key, after) > 0)
    .sort((left, right) => compareKeys(left.key, right.key));
}

function getPageRow<RowType extends Row>(row: RowType) {
  const bytes = Buffer.byteLength(JSON.stringify(row));
  if (bytes + 2 <= PAGE_BYTE_LIMIT) return { item: row, bytes };
  const item = { id: row.id, oversized: true as const };
  return { item, bytes: Buffer.byteLength(JSON.stringify(item)) };
}

export function queryRecords<RowType extends Row>(rows: readonly RowType[], options: QueryOptions) {
  const limit = Math.min(MAX_LIMIT, Math.max(1, options.limit ?? DEFAULT_LIMIT));
  const matchingRows = getMatchingRows(rows, options);
  const page: (RowType | { id: string; oversized: true })[] = [];
  let pageBytes = 2;
  let lastKey: SortKey | null = null;

  for (const { row, key } of matchingRows.slice(0, limit)) {
    const { item, bytes } = getPageRow(row);
    const nextSize = pageBytes + bytes + (page.length > 0 ? 1 : 0);
    if (page.length > 0 && nextSize > PAGE_BYTE_LIMIT) break;
    page.push(item);
    pageBytes = nextSize;
    lastKey = key;
  }

  return {
    rows: page,
    nextCursor: lastKey && page.length < matchingRows.length ? encodeCursor(lastKey) : null,
  };
}
