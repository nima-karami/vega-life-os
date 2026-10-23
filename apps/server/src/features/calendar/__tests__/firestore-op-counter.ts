import {
  DocumentReference,
  type Firestore,
  Query,
  type Transaction,
  type WriteBatch,
} from "firebase-admin/firestore";

export type OpTally = {
  reads: number;
  writes: number;
  readsBy: Record<string, number>;
  writesBy: Record<string, number>;
};

const WRITE_METHODS = new Set(["set", "update", "delete", "create"]);

/** `private/gcal` and `meta/sync` are single documents worth telling apart; anything else is its collection. */
function labelDoc(ref: DocumentReference): string {
  const parent = ref.parent.id;
  return parent === "private" || parent === "meta" ? `${parent}/${ref.id}` : parent;
}

function emptyTally(): OpTally {
  return { reads: 0, writes: 0, readsBy: {}, writesBy: {} };
}

// Metered like Firestore bills: a query costs one read per document returned, minimum one.
export function withOpCounter(firestore: Firestore) {
  let tally = emptyTally();

  const countRead = (label: string, docs: number) => {
    const billed = Math.max(1, docs);
    tally.reads += billed;
    tally.readsBy[label] = (tally.readsBy[label] ?? 0) + billed;
  };
  const countWrite = (label: string) => {
    tally.writes += 1;
    tally.writesBy[label] = (tally.writesBy[label] ?? 0) + 1;
  };

  const wrapResult = (result: unknown, label: string): unknown => {
    if (result instanceof DocumentReference) return proxyDoc(result);
    if (result instanceof Query) return proxyQuery(result, label);
    return result;
  };

  const forwardWrapped = (target: object, key: string | symbol, label: string) => {
    const member = Reflect.get(target, key);
    if (typeof member !== "function") return member;
    return (...args: unknown[]) => wrapResult(Reflect.apply(member, target, args), label);
  };

  function proxyDoc(ref: DocumentReference): DocumentReference {
    const label = labelDoc(ref);
    return new Proxy(ref, {
      get(target, key) {
        if (key === "get")
          return async () => {
            countRead(label, 1);
            return target.get();
          };
        if (typeof key === "string" && WRITE_METHODS.has(key)) {
          const method = Reflect.get(target, key) as (...args: unknown[]) => unknown;
          return (...args: unknown[]) => {
            countWrite(label);
            return Reflect.apply(method, target, args);
          };
        }
        return forwardWrapped(target, key, label);
      },
    });
  }

  function proxyQuery(query: Query, label: string): Query {
    return new Proxy(query, {
      get(target, key) {
        if (key === "get")
          return async () => {
            const snap = await target.get();
            countRead(label, snap.size);
            return snap;
          };
        return forwardWrapped(target, key, label);
      },
    });
  }

  function proxyBatch(batch: WriteBatch): WriteBatch {
    return new Proxy(batch, {
      get(target, key) {
        const member = Reflect.get(target, key);
        if (typeof member !== "function") return member;
        return (...args: unknown[]) => {
          if (typeof key === "string" && WRITE_METHODS.has(key))
            countWrite(labelDoc(args[0] as DocumentReference));
          return Reflect.apply(member, target, args);
        };
      },
    });
  }

  function proxyTransaction(tx: Transaction): Transaction {
    return new Proxy(tx, {
      get(target, key) {
        const member = Reflect.get(target, key);
        if (typeof member !== "function") return member;
        return async (...args: unknown[]) => {
          if (typeof key === "string" && WRITE_METHODS.has(key)) {
            countWrite(labelDoc(args[0] as DocumentReference));
            return Reflect.apply(member, target, args);
          }
          const result = await Reflect.apply(member, target, args);
          if (key === "get" && args[0] instanceof DocumentReference)
            countRead(labelDoc(args[0]), 1);
          return result;
        };
      },
    });
  }

  const proxied = new Proxy(firestore, {
    get(target, key) {
      if (key === "collection")
        return (path: string) =>
          proxyQuery(target.collection(path), path.split("/").at(-1) ?? path);
      if (key === "collectionGroup")
        return (id: string) => proxyQuery(target.collectionGroup(id), `group:${id}`);
      if (key === "doc") return (path: string) => proxyDoc(target.doc(path));
      if (key === "batch") return () => proxyBatch(target.batch());
      if (key === "getAll")
        return async (...refs: DocumentReference[]) => {
          for (const ref of refs) countRead(labelDoc(ref), 1);
          return target.getAll(...refs);
        };
      if (key === "runTransaction")
        return <T>(run: (tx: Transaction) => Promise<T>) =>
          target.runTransaction((tx) => run(proxyTransaction(tx)));
      const member = Reflect.get(target, key);
      return typeof member === "function" ? member.bind(target) : member;
    },
  });

  return {
    firestore: proxied,
    reset: () => {
      tally = emptyTally();
    },
    read: (): OpTally => structuredClone(tally),
  };
}
