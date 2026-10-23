import { type ChannelRegistration, channelRegistrySchema } from "@vega/shared";
import type { Firestore } from "firebase-admin/firestore";

const registry = (firestore: Firestore) => firestore.collection("channelRegistry");

export async function registerChannel(
  firestore: Firestore,
  registration: ChannelRegistration,
): Promise<void> {
  await registry(firestore)
    .doc(registration.channelId)
    .set(channelRegistrySchema.parse(registration));
}

export async function lookupChannel(
  firestore: Firestore,
  channelId: string,
): Promise<ChannelRegistration | null> {
  const snap = await registry(firestore).doc(channelId).get();
  return snap.exists ? (snap.data() as ChannelRegistration) : null;
}

export async function removeChannel(firestore: Firestore, channelId: string): Promise<void> {
  await registry(firestore).doc(channelId).delete();
}

export async function listChannelsForUid(
  firestore: Firestore,
  uid: string,
): Promise<ChannelRegistration[]> {
  const snap = await registry(firestore).where("uid", "==", uid).get();
  return snap.docs.map((doc) => doc.data() as ChannelRegistration);
}
