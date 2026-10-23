// src/core/persistence/sandbox-meta.ts
import { db } from "./db";

const KEY = "sandbox";

/** Read the persisted sandbox-dirty flag (undefined if never written). */
export async function getSandboxDirty(): Promise<boolean | undefined> {
  try {
    const row = await db.meta.get(KEY);
    return row?.dirty;
  } catch {
    return undefined;
  }
}

// Every signed-out save calls this, so only a change of the flag reaches IndexedDB.
let lastWrittenDirty: boolean | undefined;

/** Persist the sandbox-dirty flag. Fire-and-forget callers may ignore the promise. */
export async function setSandboxDirty(dirty: boolean): Promise<void> {
  if (lastWrittenDirty === dirty) return;
  lastWrittenDirty = dirty;
  try {
    await db.meta.put({ key: KEY, dirty });
  } catch {
    lastWrittenDirty = undefined;
  }
}

/**
 * Pure decision: is the local sandbox "dirty" (worth warning before we clear it
 * on sign-in)? True if explicitly flagged, or — failing safe — if the flag is
 * missing but the sandbox still holds rows.
 */
export function isSandboxDirty(flag: boolean | undefined, hasRows: boolean): boolean {
  return flag === true || (flag === undefined && hasRows);
}
