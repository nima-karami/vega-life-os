import type { Firestore } from "firebase-admin/firestore";
import type { GoogleCalendarClient } from "./google-client";
import { readGcalAccount, writeGcalAccount } from "./token-store";

const WRITE_CALENDAR_SUMMARY = "VEGA";

/**
 * Ensure the user has a dedicated VEGA write-calendar and remember its id. Created once on first
 * connect; reused on reconnect while the account still holds it. Without this the sync engine has
 * no calendar to write to and reconcile is a no-op.
 */
export async function ensureWriteCalendar(
  firestore: Firestore,
  uid: string,
  client: GoogleCalendarClient,
): Promise<string> {
  const account = await readGcalAccount(firestore, uid);
  if (account?.writeCalendarId) return account.writeCalendarId;
  const { id } = await client.insertCalendar(WRITE_CALENDAR_SUMMARY);
  await writeGcalAccount(firestore, uid, { writeCalendarId: id });
  return id;
}
