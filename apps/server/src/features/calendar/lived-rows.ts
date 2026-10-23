import type { CalendarEvent, Tombstone } from "@vega/shared";
import type { WritableEntity } from "../../core/repository";
import type { RecordWriter } from "./record-writer";

export type LivedRow = WritableEntity<"calendarEvents">;

/**
 * The lived lane's view of `calendarEvents`, read once per run. Every step works on it in memory and
 * stages its writes; `flush` lands them all in batched commits behind a single counter bump.
 */
export type LivedRows = {
  list(): CalendarEvent[];
  put(row: LivedRow): void;
  drop(id: string, tombstonedGoogleId?: string): void;
  flush(): Promise<void>;
};

export function createLivedRows(
  rows: CalendarEvent[],
  writer: RecordWriter,
  now: string,
): LivedRows {
  const current = new Map(rows.map((row) => [row.id, row]));
  const persistedIds = new Set(current.keys());
  const puts = new Map<string, LivedRow>();
  const drops = new Set<string>();
  const googleMarks: Tombstone[] = [];

  return {
    list: () => [...current.values()],
    put(row) {
      current.set(row.id, { ...current.get(row.id), ...row } as CalendarEvent);
      puts.set(row.id, row);
      drops.delete(row.id);
    },
    drop(id, tombstonedGoogleId) {
      current.delete(id);
      puts.delete(id);
      if (persistedIds.has(id)) drops.add(id);
      if (tombstonedGoogleId)
        googleMarks.push({ collection: "calendarEvents", id: tombstonedGoogleId, deletedAt: now });
    },
    async flush() {
      await writer.upsertMany("calendarEvents", [...puts.values()]);
      await writer.removeMany("calendarEvents", [...drops], googleMarks);
    },
  };
}
