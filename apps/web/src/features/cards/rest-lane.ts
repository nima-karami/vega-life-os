import type { Card } from "@vega/shared";
import { createWeightTree, type WeightTree } from "./weight-tree";

export type RestLaneCard = { card: Card; categoryIndex: number; weight: number; isDue: boolean };

/** Which shaping guards are in force for one draw. `blockedCategory` is -1 when none is. */
export type RestFilter = { blockedCategory: number; isExcludeActive: boolean };

export type RestLane = {
  hasRemaining: () => boolean;
  countCandidates: (filter: RestFilter) => number;
  pickWeighted: (filter: RestFilter, roll: number) => number;
  takeCard: (index: number) => Card;
  capCategory: (categoryIndex: number) => void;
};

const MIN_BLOCK_SIZE = 16;
const MAX_TALLY_CELLS = 1 << 20;

// Many distinct categories widen the blocks instead of growing the tallies without bound.
const computeBlockSize = (size: number, categoryCount: number): number =>
  Math.max(MIN_BLOCK_SIZE, Math.ceil((size * categoryCount) / MAX_TALLY_CELLS));

/**
 * The rest lane in pool order, cut into small blocks that each keep their eligible weight and
 * a per-category tally of it, both under Fenwick trees. A draw finds its block in O(log N) —
 * less the blocked category's tree while the interleave guard holds one — then walks that
 * block's cards, so it lands on the card a linear walk over the whole lane would.
 */
export function createRestLane(
  entries: readonly RestLaneCard[],
  excludedIds: ReadonlySet<string>,
  categoryCount: number,
): RestLane {
  const size = entries.length;
  const blockSize = computeBlockSize(size, categoryCount);
  const blockTotal = Math.ceil(size / blockSize);
  const category = new Int32Array(size);
  const weight = new Float64Array(size);
  const isDue = new Uint8Array(size);
  const isExcluded = new Uint8Array(size);
  const excludedIndices: number[] = [];
  const isLive = new Uint8Array(size).fill(1);
  const isCapped = new Uint8Array(categoryCount);
  const nonDueCountByCategory = new Int32Array(categoryCount);
  const blockSum = new Float64Array(blockTotal);
  const blockCount = new Int32Array(blockTotal);
  const tallySum = new Float64Array(blockTotal * categoryCount);
  const tallyCount = new Int32Array(blockTotal * categoryCount);
  const effectiveSum = new Float64Array(blockTotal);
  const effectiveCount = new Int32Array(blockTotal);
  let liveCount = size;
  let eligibleCount = size;

  const isBaseEligible = (index: number): boolean =>
    isLive[index] === 1 && (isDue[index] === 1 || isCapped[category[index]] === 0);

  const isFilteredOut = (index: number, filter: RestFilter): boolean =>
    (isDue[index] === 0 && category[index] === filter.blockedCategory) ||
    (filter.isExcludeActive && isExcluded[index] === 1);

  const isCandidate = (index: number, filter: RestFilter): boolean =>
    isBaseEligible(index) && !isFilteredOut(index, filter);

  // An emptied block or tally is pinned to an exact zero so decrement drift never outlives it.
  const dropFromBlock = (index: number): void => {
    const block = Math.floor(index / blockSize);
    const count = blockCount[block] - 1;
    const sum = count === 0 ? 0 : blockSum[block] - weight[index];
    blockTree.add(block, sum - blockSum[block]);
    blockSum[block] = sum;
    blockCount[block] = count;
    if (isDue[index] === 1) return;
    const cell = block * categoryCount + category[index];
    const tallied = tallyCount[cell] - 1;
    const tally = tallied === 0 ? 0 : tallySum[cell] - weight[index];
    categoryTrees.get(category[index])?.add(block, tally - tallySum[cell]);
    tallySum[cell] = tally;
    tallyCount[cell] = tallied;
  };

  const recountBlock = (block: number, touchedCategory: number): void => {
    let sum = 0;
    let count = 0;
    let categorySum = 0;
    let categoryCountInBlock = 0;
    const end = Math.min(size, (block + 1) * blockSize);
    for (let index = block * blockSize; index < end; index++) {
      if (!isBaseEligible(index)) continue;
      sum += weight[index];
      count += 1;
      if (isDue[index] === 0 && category[index] === touchedCategory) {
        categorySum += weight[index];
        categoryCountInBlock += 1;
      }
    }
    blockTree.add(block, sum - blockSum[block]);
    blockSum[block] = sum;
    blockCount[block] = count;
    const cell = block * categoryCount + touchedCategory;
    categoryTrees.get(touchedCategory)?.add(block, categorySum - tallySum[cell]);
    tallySum[cell] = categorySum;
    tallyCount[cell] = categoryCountInBlock;
  };

  for (let index = 0; index < size; index++) {
    const entry = entries[index];
    category[index] = entry.categoryIndex;
    weight[index] = entry.weight;
    isDue[index] = entry.isDue ? 1 : 0;
    if (excludedIds.size > 0 && excludedIds.has(entry.card.id)) {
      isExcluded[index] = 1;
      excludedIndices.push(index);
    }
    const block = Math.floor(index / blockSize);
    blockSum[block] += weight[index];
    blockCount[block] += 1;
    if (isDue[index] === 1) continue;
    nonDueCountByCategory[category[index]] += 1;
    tallySum[block * categoryCount + category[index]] += weight[index];
    tallyCount[block * categoryCount + category[index]] += 1;
  }
  const blockTree = createWeightTree(blockSum);
  const categoryTrees = new Map<number, WeightTree>();

  // Built the first time the interleave guard blocks a category, then kept in step.
  const readCategoryTree = (categoryIndex: number): WeightTree => {
    const existing = categoryTrees.get(categoryIndex);
    if (existing) return existing;
    const column = new Float64Array(blockTotal);
    for (let block = 0; block < blockTotal; block++) {
      column[block] = tallySum[block * categoryCount + categoryIndex];
    }
    const tree = createWeightTree(column);
    categoryTrees.set(categoryIndex, tree);
    return tree;
  };

  const countExcludedCandidates = (filter: RestFilter): number => {
    if (!filter.isExcludeActive) return 0;
    const unexcluded: RestFilter = { ...filter, isExcludeActive: false };
    return excludedIndices.filter((index) => isCandidate(index, unexcluded)).length;
  };

  const countCandidates = (filter: RestFilter): number => {
    const blocked = filter.blockedCategory < 0 ? 0 : nonDueCountByCategory[filter.blockedCategory];
    return eligibleCount - blocked - countExcludedCandidates(filter);
  };

  const subtractExcluded = (filter: RestFilter): void => {
    const unexcluded: RestFilter = { ...filter, isExcludeActive: false };
    for (const index of excludedIndices) {
      if (!isCandidate(index, unexcluded)) continue;
      const block = Math.floor(index / blockSize);
      effectiveSum[block] -= weight[index];
      effectiveCount[block] -= 1;
    }
  };

  const computeEffectiveTotal = (filter: RestFilter): number => {
    const blocked = filter.blockedCategory;
    for (let block = 0; block < blockTotal; block++) {
      const cell = block * categoryCount + blocked;
      effectiveSum[block] = blockSum[block] - (blocked < 0 ? 0 : tallySum[cell]);
      effectiveCount[block] = blockCount[block] - (blocked < 0 ? 0 : tallyCount[cell]);
    }
    if (filter.isExcludeActive) subtractExcluded(filter);
    let total = 0;
    for (let block = 0; block < blockTotal; block++) {
      if (effectiveCount[block] > 0) total += effectiveSum[block];
    }
    return total;
  };

  const findLastCandidate = (filter: RestFilter): number => {
    for (let index = size - 1; index >= 0; index--) if (isCandidate(index, filter)) return index;
    return -1;
  };

  const walkBlock = (block: number, filter: RestFilter, threshold: number): number => {
    let remaining = threshold;
    const end = Math.min(size, (block + 1) * blockSize);
    for (let index = block * blockSize; index < end; index++) {
      if (!isCandidate(index, filter)) continue;
      remaining -= weight[index];
      if (remaining < 0) return index;
    }
    return -1;
  };

  // Rounding can leave the threshold a hair past the last weight, exactly as a linear walk
  // can; both then settle on the last candidate.
  const pickByScan = (filter: RestFilter, roll: number): number => {
    let threshold = roll * computeEffectiveTotal(filter);
    for (let block = 0; block < blockTotal; block++) {
      if (effectiveCount[block] === 0) continue;
      if (threshold - effectiveSum[block] < 0) {
        const picked = walkBlock(block, filter, threshold);
        if (picked !== -1) return picked;
      }
      threshold = Math.max(0, threshold - effectiveSum[block]);
    }
    return findLastCandidate(filter);
  };

  // The exclude window covers only a pass's first few slots, so it alone takes the scan.
  const pickWeighted = (filter: RestFilter, roll: number): number => {
    if (filter.isExcludeActive) return pickByScan(filter, roll);
    const blocked =
      filter.blockedCategory < 0 ? undefined : readCategoryTree(filter.blockedCategory);
    const threshold = roll * (blockTree.total() - (blocked?.total() ?? 0));
    const { index: block, before } = blockTree.locate(threshold, blocked);
    const picked = block < blockTotal ? walkBlock(block, filter, threshold - before) : -1;
    return picked === -1 ? pickByScan(filter, roll) : picked;
  };

  const takeCard = (index: number): Card => {
    if (isBaseEligible(index)) {
      eligibleCount -= 1;
      if (isDue[index] === 0) nonDueCountByCategory[category[index]] -= 1;
      dropFromBlock(index);
    }
    isLive[index] = 0;
    liveCount -= 1;
    return entries[index].card;
  };

  const capCategory = (categoryIndex: number): void => {
    if (isCapped[categoryIndex] === 1) return;
    isCapped[categoryIndex] = 1;
    eligibleCount -= nonDueCountByCategory[categoryIndex];
    nonDueCountByCategory[categoryIndex] = 0;
    for (let block = 0; block < blockTotal; block++) {
      if (tallyCount[block * categoryCount + categoryIndex] > 0) recountBlock(block, categoryIndex);
    }
  };

  return {
    hasRemaining: () => liveCount > 0,
    countCandidates,
    pickWeighted,
    takeCard,
    capCategory,
  };
}
