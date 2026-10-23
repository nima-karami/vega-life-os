import type { CalendarEvent, Tombstone } from "@vega/shared";
import type { WritableEntity } from "../../core/repository";
import type { RecordRemoval, RecordWriter } from "./record-writer";

export type LivedRow = WritableEntity<"calendarEvents">;

/** The lived lane's in-memory view of `calendarEvents`; staged writes land in one `flush`. */
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
  const drops = new Map<string, RecordRemoval>();
  const orphanMarks: Tombstone[] = [];

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
      const marks: Tombstone[] = tombstonedGoogleId
        ? [{ collection: "calendarEvents", id: tombstonedGoogleId, deletedAt: now }]
        : [];
      if (persistedIds.has(id)) drops.set(id, { id, marks });
      else orphanMarks.push(...marks);
    },
    async flush() {
      await writer.upsertMany("calendarEvents", [...puts.values()]);
      await writer.removeMany("calendarEvents", [...drops.values()]);
      await writer.markTombstones(orphanMarks);
    },
  };
}
