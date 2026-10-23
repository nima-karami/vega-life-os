import type { SyncReceipt } from "@vega/shared";
import type { SyncedWrite } from "./repository";

export type WireRow<T> = Omit<T, "fieldUpdatedAt">;

/** The field-LWW stamps are half of every stored doc and only the server merges with them. */
export function toWireRow<T extends { fieldUpdatedAt?: unknown }>(row: T): WireRow<T> {
  const { fieldUpdatedAt: _fieldUpdatedAt, ...wireRow } = row;
  return wireRow;
}

export function toWireRows<T extends { fieldUpdatedAt?: unknown }>(rows: T[]): WireRow<T>[] {
  return rows.map(toWireRow);
}

export function toSyncedResponse<T extends object>(write: SyncedWrite<T>): T & SyncReceipt {
  return { ...write.record, syncVersion: write.syncVersion };
}
