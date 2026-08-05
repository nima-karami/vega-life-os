import type { Firestore, WriteBatch } from "firebase-admin/firestore";

/** Fails the nth `batch().commit()` once armed, so the partial-commit path can be exercised end to end. */
export function withFailingCommit(firestore: Firestore) {
  const state = { commits: 0, failAt: Number.POSITIVE_INFINITY };
  const proxied = new Proxy(firestore, {
    get(target, key, receiver) {
      if (key !== "batch") return bindMember(target, key, receiver);
      return () => proxyBatch(target.batch(), state);
    },
  });
  const armFailure = (failAt: number) => {
    state.commits = 0;
    state.failAt = failAt;
  };
  return { firestore: proxied, armFailure };
}

function proxyBatch(batch: WriteBatch, state: { commits: number; failAt: number }): WriteBatch {
  return new Proxy(batch, {
    get(target, key, receiver) {
      if (key !== "commit") return bindMember(target, key, receiver);
      return async () => {
        state.commits += 1;
        if (state.commits >= state.failAt) throw new Error("emulated commit failure");
        return target.commit();
      };
    },
  });
}

function bindMember(target: object, key: string | symbol, receiver: unknown): unknown {
  const member = Reflect.get(target, key, receiver);
  return typeof member === "function" ? member.bind(target) : member;
}
