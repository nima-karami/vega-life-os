import type { Firestore } from "firebase-admin/firestore";

type TransactionHook = () => Promise<void>;

/**
 * Runs a hook before the nth `runTransaction` once armed: throw to fail that transaction, or write
 * to race it, the way a concurrent client would between a plan and its commit.
 */
export function withFailingTransaction(firestore: Firestore) {
  const state = { calls: 0, hooks: new Map<number, TransactionHook>() };
  const runTransaction: Firestore["runTransaction"] = async (update, options) => {
    state.calls += 1;
    await state.hooks.get(state.calls)?.();
    return firestore.runTransaction(update, options);
  };
  const proxied = new Proxy(firestore, {
    get: (target, key) => {
      if (key === "runTransaction") return runTransaction;
      const member: unknown = Reflect.get(target, key);
      return typeof member === "function" ? member.bind(target) : member;
    },
  });
  const beforeTransaction = (callNumber: number, hook: TransactionHook) => {
    state.hooks.set(callNumber, hook);
  };
  const failTransaction = (callNumber: number) =>
    beforeTransaction(callNumber, async () => {
      throw new Error("emulated transaction failure");
    });
  const reset = () => {
    state.calls = 0;
    state.hooks.clear();
  };
  return { firestore: proxied, beforeTransaction, failTransaction, reset };
}
