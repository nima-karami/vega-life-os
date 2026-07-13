import { type CollectionName, type Dataset, persistence } from "@/core/persistence";
import { setSandboxDirty } from "@/core/persistence/sandbox-meta";

/** Current auth uid, mirrored here so signed-out writes can flag the sandbox dirty. */
let _authUid: string | null = null;
export function setPersistAuth(uid: string | null) {
  _authUid = uid;
}

/** Mark the local sandbox dirty on any signed-out user write (not seeding — seeds use bulkPut). */
function markDirtyIfSandbox() {
  if (_authUid === null) void setSandboxDirty(true);
}

/** Fire-and-forget persistence helpers used by store slices. */
export function savePut<C extends CollectionName>(col: C, item: Dataset[C][number]) {
  void persistence.put(col, item).catch((e) => console.error("persist", col, e));
  markDirtyIfSandbox();
}

export function saveRemove(col: CollectionName, id: string) {
  void persistence.remove(col, id).catch((e) => console.error("remove", col, e));
  markDirtyIfSandbox();
}

export function saveBulk<C extends CollectionName>(col: C, items: Dataset[C]) {
  void persistence.bulkPut(col, items).catch((e) => console.error("bulk", col, e));
}
