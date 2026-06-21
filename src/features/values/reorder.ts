/**
 * Pure reorder helper shared by the values list and each value's goal list.
 * Swaps the `order` field of an item with its neighbour in the given direction.
 *
 * Returns ONLY the entities whose `order` changed (the moved item + its
 * neighbour), each as `{ id, order }`, so the caller persists them with the
 * existing `updateValue` / `updateGoal` actions. Returns `[]` for any no-op
 * (item not found, already at an edge), so callers can skip a spurious write.
 */
export type MoveDirection = "up" | "down";

export interface Orderable {
  id: string;
  order: number;
}

export function reorderedOrders<T extends Orderable>(
  items: readonly T[],
  id: string,
  direction: MoveDirection,
): { id: string; order: number }[] {
  const sorted = [...items].sort((a, b) => a.order - b.order);
  const index = sorted.findIndex((i) => i.id === id);
  if (index === -1) return [];

  const neighbourIndex = direction === "up" ? index - 1 : index + 1;
  if (neighbourIndex < 0 || neighbourIndex >= sorted.length) return [];

  const item = sorted[index];
  const neighbour = sorted[neighbourIndex];
  // swap their order values; emit the two affected rows in their new visual order
  const updated = [
    { id: item.id, order: neighbour.order },
    { id: neighbour.id, order: item.order },
  ];
  return updated.sort((a, b) => a.order - b.order);
}
