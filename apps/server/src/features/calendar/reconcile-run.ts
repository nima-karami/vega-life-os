import type { Tombstone } from "@vega/shared";
import type { Firestore } from "firebase-admin/firestore";
import type { GoogleCalendarClient } from "./google-client";
import type { RecordWriter } from "./record-writer";
import type { GcalAccount } from "./token-store";

// `tombstones` grows as the run writes new ones, so later steps see them without a re-read.
export type ReconcileRun = {
  firestore: Firestore;
  uid: string;
  client: GoogleCalendarClient;
  account: GcalAccount;
  now: string;
  writer: RecordWriter;
  tombstones: Tombstone[];
};
