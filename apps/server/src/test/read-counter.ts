import { collectionNameSchema } from "@vega/shared";
import {
  DocumentReference,
  type DocumentSnapshot,
  Firestore,
  Query,
  type QuerySnapshot,
  Transaction,
} from "firebase-admin/firestore";
import { vi } from "vitest";

export type ReadTally = { dataset: number; counter: number; other: number };

const DATASET_COLLECTIONS = new Set<string>(collectionNameSchema.options);

function classifyPath(path: string | undefined): keyof ReadTally {
  const segments = (path ?? "").split("/");
  if (segments[0] !== "users") return "other";
  if (segments[2] === "meta" && segments[3] === "sync") return "counter";
  return DATASET_COLLECTIONS.has(segments[2]) ? "dataset" : "other";
}

/**
 * Tallies billed document reads by what they touched, through spies on the SDK's read methods —
 * an empty query is billed as one read, so it counts as one here too.
 */
export function countFirestoreReads() {
  const tally: ReadTally = { dataset: 0, counter: 0, other: 0 };
  const record = (path: string | undefined, reads: number) => {
    tally[classifyPath(path)] += reads;
  };

  const queryGet = Query.prototype.get;
  vi.spyOn(Query.prototype, "get").mockImplementation(async function (this: Query) {
    const snapshot: QuerySnapshot = await queryGet.call(this);
    record((this as unknown as { path?: string }).path, Math.max(1, snapshot.size));
    return snapshot;
  });

  // `DocumentReference.get` delegates here, so spying it too would count each read twice.
  const getAll = Firestore.prototype.getAll;
  vi.spyOn(Firestore.prototype, "getAll").mockImplementation(async function (
    this: Firestore,
    ...args: Parameters<Firestore["getAll"]>
  ) {
    for (const arg of args) if (arg instanceof DocumentReference) record(arg.path, 1);
    return getAll.apply(this, args);
  });

  const transactionGet = Transaction.prototype.get;
  vi.spyOn(Transaction.prototype, "get").mockImplementation(function (
    this: Transaction,
    target: unknown,
  ) {
    if (target instanceof DocumentReference) record(target.path, 1);
    return (transactionGet as (target: unknown) => Promise<DocumentSnapshot>).call(this, target);
  } as Transaction["get"]);

  return {
    tally,
    reset() {
      tally.dataset = 0;
      tally.counter = 0;
      tally.other = 0;
    },
    restore() {
      vi.restoreAllMocks();
    },
  };
}
