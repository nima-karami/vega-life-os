import type { Tombstone } from "@vega/shared";
import type { Firestore } from "firebase-admin/firestore";
import type { GoogleCalendarClient } from "./google-client";
import type { RecordWriter } from "./record-writer";
import type { GcalAccount } from "./token-store";

/**
 * One locked reconcile's shared state: everything both lanes need is read once up front and
 * threaded through, and `tombstones` grows as the run writes new ones so later steps see them.
 */
export type ReconcileRun = {
  firestore: Firestore;
  uid: string;
  client: GoogleCalendarClient;
  account: GcalAccount;
  now: string;
  writer: RecordWriter;
  tombstones: Tombstone[];
};
