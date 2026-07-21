import { FieldValue, type Firestore } from "firebase-admin/firestore";
import { type GcalAccount, writeGcalAccount } from "./token-store";

/**
 * One-shot move of the legacy profile-doc read-calendar selection into the account doc
 * (the split-brain fix: production wrote the picker to `users/{uid}` while the lived lane
 * read `users/{uid}/private/gcal`). Runs under the sync lease; idempotent.
 */
export async function migrateProfileCalendarConfig(
  firestore: Firestore,
  uid: string,
  account: GcalAccount,
): Promise<GcalAccount> {
  if (account.readCalendarIds?.length) return account;
  const profileSnap = await firestore.doc(`users/${uid}`).get();
  const legacy = (profileSnap.data() ?? {}) as { gcalReadCalendarIds?: string[] };
  if (!legacy.gcalReadCalendarIds?.length) return account;
  const readCalendarIds = legacy.gcalReadCalendarIds;
  await writeGcalAccount(firestore, uid, { readCalendarIds });
  await firestore
    .doc(`users/${uid}`)
    .set(
      { gcalReadCalendarIds: FieldValue.delete(), gcalWriteCalendarId: FieldValue.delete() },
      { merge: true },
    );
  return { ...account, readCalendarIds };
}
