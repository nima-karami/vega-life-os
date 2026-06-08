import {
  persistence,
  type CollectionName,
  type Dataset,
} from "@/core/persistence";

/** Fire-and-forget persistence helpers used by store slices. */
export function savePut<C extends CollectionName>(
  col: C,
  item: Dataset[C][number],
) {
  void persistence.put(col, item).catch((e) => console.error("persist", col, e));
}

export function saveRemove(col: CollectionName, id: string) {
  void persistence.remove(col, id).catch((e) => console.error("remove", col, e));
}

export function saveBulk<C extends CollectionName>(col: C, items: Dataset[C]) {
  void persistence.bulkPut(col, items).catch((e) => console.error("bulk", col, e));
}
