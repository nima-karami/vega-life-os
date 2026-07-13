/**
 * Pure list-reorder helpers for drag-and-drop. Shared by every sortable surface
 * (values, goals, tasks) and the SortableList primitive.
 */
export interface Orderable {
  id: string;
  order: number;
}

/** Immutable splice-move: returns a copy of `list` with the item at `from` moved to `to`. */
export function arrayMove<T>(list: readonly T[], from: number, to: number): T[] {
  const next = [...list];
  const [moved] = next.splice(from, 1);
  next.splice(to, 0, moved);
  return next;
}

/**
 * Reorder by dragging `activeId` onto `overId`'s slot, operating on the items in
 * their already-displayed sequence. Returns the minimal set of {id, order} rows
 * whose order changed, renumbered to the new visual positions. Empty for any
 * no-op (either id missing, or dropped on itself).
 */
export function reorderByIds<T extends Orderable>(
  displayed: readonly T[],
  activeId: string,
  overId: string,
): { id: string; order: number }[] {
  const from = displayed.findIndex((i) => i.id === activeId);
  const to = displayed.findIndex((i) => i.id === overId);
  if (from === -1 || to === -1 || from === to) return [];
  const changes: { id: string; order: number }[] = [];
  arrayMove(displayed, from, to).forEach((item, order) => {
    if (item.order !== order) changes.push({ id: item.id, order });
  });
  return changes;
}
