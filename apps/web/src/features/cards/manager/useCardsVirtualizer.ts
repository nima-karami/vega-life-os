import {
  defaultRangeExtractor,
  type Range,
  useVirtualizer,
  type VirtualItem,
} from "@tanstack/react-virtual";
import {
  useCallback,
  useDeferredValue,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigationType } from "react-router";
import { getAppScroller } from "@/core/ui";
import { computeSpacers, includeFocusedIndex } from "./virtual-window";

export type CardsListKey = "table" | "mobile" | "gallery";

interface ListScroll {
  listKey: CardsListKey;
  offset: number;
  measurements: VirtualItem[];
}

// One slot, so a view toggle never replays an older visit's offset.
let lastListScroll: ListScroll | null = null;

const recallListScroll = (listKey: CardsListKey): ListScroll | undefined =>
  lastListScroll?.listKey === listKey ? lastListScroll : undefined;

const defaultItemKey = (index: number) => index;

function readIndexOf(target: EventTarget | null): number | null {
  if (!(target instanceof Element)) return null;
  const item = target.closest("[data-index]");
  return item === null ? null : Number(item.getAttribute("data-index"));
}

/**
 * Windows a manager list against the app shell's scroller. The page keeps its own scroll, so
 * the list is offset by everything above it (`scrollMargin`) and padded to its full height.
 */
export function useCardsVirtualizer<Row>({
  listKey,
  rows,
  estimateSize,
  overscan,
  getItemKey = defaultItemKey,
}: {
  listKey: CardsListKey;
  rows: Row[];
  estimateSize: (index: number) => number;
  overscan: number;
  getItemKey?: (index: number) => string | number;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const focusedKeyRef = useRef<string | number | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [hasKeyboardFocus, setHasKeyboardFocus] = useState(false);
  const navigationType = useNavigationType();
  const [restore] = useState(() =>
    navigationType === "POP" ? recallListScroll(listKey) : undefined,
  );

  const indexByKey = useMemo(
    () => new Map(rows.map((_, index) => [getItemKey(index), index])),
    [rows, getItemKey],
  );
  const indexByKeyRef = useRef(indexByKey);
  indexByKeyRef.current = indexByKey;
  const getItemKeyRef = useRef(getItemKey);
  getItemKeyRef.current = getItemKey;

  const rangeExtractor = useCallback((range: Range) => {
    const focusedKey = focusedKeyRef.current;
    const focusedIndex = focusedKey === null ? null : indexByKeyRef.current.get(focusedKey);
    return includeFocusedIndex(defaultRangeExtractor(range), focusedIndex ?? null, range.count);
  }, []);

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: getAppScroller,
    estimateSize,
    overscan,
    getItemKey,
    scrollMargin,
    rangeExtractor,
    initialOffset: restore?.offset,
    // Measured heights come back with the offset, or unmeasured estimates shift the landing row.
    initialMeasurementsCache: restore?.measurements,
    initialRect: { width: 0, height: window.innerHeight },
    useFlushSync: false,
  });

  // Anything above the list resizes an ancestor, so no per-frame read is needed.
  useLayoutEffect(() => {
    const list = listRef.current;
    const scroller = getAppScroller();
    if (list === null || scroller === null) return;
    const measure = () =>
      setScrollMargin(
        Math.round(
          list.getBoundingClientRect().top -
            scroller.getBoundingClientRect().top +
            scroller.scrollTop,
        ),
      );
    measure();
    const observer = new ResizeObserver(measure);
    for (let box = list.parentElement; box !== null && box !== scroller; box = box.parentElement) {
      observer.observe(box);
    }
    return () => observer.disconnect();
  }, []);

  useLayoutEffect(() => {
    const scroller = getAppScroller();
    if (scroller === null) return;
    if (restore !== undefined) scroller.scrollTop = restore.offset;
    return () => {
      lastListScroll = {
        listKey,
        offset: scroller.scrollTop,
        measurements: virtualizer.takeSnapshot(),
      };
    };
  }, [listKey, restore, virtualizer]);

  useEffect(() => {
    const list = listRef.current;
    if (list === null) return;
    const handleFocusIn = (event: FocusEvent) => {
      const index = readIndexOf(event.target);
      focusedKeyRef.current = index === null ? null : getItemKeyRef.current(index);
      setHasKeyboardFocus(
        event.target instanceof Element && event.target.matches(":focus-visible"),
      );
    };
    const handleFocusOut = (event: FocusEvent) => {
      if (list.contains(event.relatedTarget as Node | null)) return;
      focusedKeyRef.current = null;
      setHasKeyboardFocus(false);
    };
    list.addEventListener("focusin", handleFocusIn);
    list.addEventListener("focusout", handleFocusOut);
    return () => {
      list.removeEventListener("focusin", handleFocusIn);
      list.removeEventListener("focusout", handleFocusOut);
    };
  }, []);

  const items = virtualizer.getVirtualItems();
  const totalSize = virtualizer.getTotalSize();
  const snapshot = useMemo(() => ({ items, rows, totalSize }), [items, rows, totalSize]);
  // Only a scroll mounts in an interruptible pass; keyboard focus and a new row set can't wait.
  const deferredSnapshot = useDeferredValue(snapshot);
  const shown = hasKeyboardFocus || deferredSnapshot.rows !== rows ? snapshot : deferredSnapshot;
  const spacers = computeSpacers(shown.items, shown.totalSize, scrollMargin);
  const slots = shown.items.map((item, position) => ({
    key: item.key,
    index: item.index,
    row: shown.rows[item.index],
    gapPx: spacers.gaps[position],
  }));

  return { virtualizer, listRef, slots, spacers };
}
