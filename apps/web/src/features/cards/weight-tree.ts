/** A Fenwick tree of non-negative weights: point updates, the total and a prefix search in O(log n). */
export type WeightTree = {
  add: (index: number, delta: number) => void;
  total: () => number;
  readNode: (node: number) => number;
  /**
   * The first index whose running total passes `threshold`, and the weight before it. With
   * `minus`, the search runs over this tree's weights less that tree's, index by index.
   */
  locate: (threshold: number, minus?: WeightTree) => { index: number; before: number };
};

export function createWeightTree(weights: ArrayLike<number>): WeightTree {
  const size = weights.length;
  const tree = new Float64Array(size + 1);
  for (let node = 1; node <= size; node++) {
    tree[node] += weights[node - 1];
    const parent = node + (node & -node);
    if (parent <= size) tree[parent] += tree[node];
  }
  let topStep = 1;
  while (topStep * 2 <= size) topStep *= 2;

  const add = (index: number, delta: number): void => {
    for (let node = index + 1; node <= size; node += node & -node) tree[node] += delta;
  };

  const total = (): number => {
    let sum = 0;
    for (let node = size; node > 0; node -= node & -node) sum += tree[node];
    return sum;
  };

  const locate = (threshold: number, minus?: WeightTree): { index: number; before: number } => {
    let position = 0;
    let before = 0;
    for (let step = topStep; step > 0; step >>= 1) {
      const next = position + step;
      if (next > size) continue;
      const span = tree[next] - (minus ? minus.readNode(next) : 0);
      if (before + span <= threshold) {
        position = next;
        before += span;
      }
    }
    return { index: position, before };
  };

  return { add, total, readNode: (node) => tree[node], locate };
}
