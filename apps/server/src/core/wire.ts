import type { SyncReceipt, WireRow } from "@vega/shared";
import type { SyncedWrite } from "./repository";

export function toWireRow<T extends { fieldUpdatedAt?: unknown }>(row: T): WireRow<T> {
  const { fieldUpdatedAt: _fieldUpdatedAt, ...wireRow } = row;
  return wireRow;
}

export function toWireRows<T extends { fieldUpdatedAt?: unknown }>(rows: T[]): WireRow<T>[] {
  return rows.map(toWireRow);
}

export function toSyncedResponse<T extends { fieldUpdatedAt?: unknown }>(
  write: SyncedWrite<T>,
): WireRow<T> & SyncReceipt {
  return { ...toWireRow(write.record), syncVersion: write.syncVersion };
}
