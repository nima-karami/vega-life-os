import { defaultRangeExtractor, type Range, useVirtualizer } from "@tanstack/react-virtual";
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
import { computeSpacers, includeFocusedIndex } from "./virtual-window";

export type CardsListKey = "table" | "mobile" | "gallery";

// Survives the route unmount, so Back from a card lands where the list was left. One slot, not
// one per view: a view toggle must not replay an older visit's offset.
let lastListScroll: { listKey: CardsListKey; offset: number } | null = null;

const recallScrollOffset = (listKey: CardsListKey): number | undefined =>
  lastListScroll?.listKey === listKey ? lastListScroll.offset : undefined;

function findScrollParent(node: HTMLElement): HTMLElement | null {
  for (let parent = node.parentElement; parent !== null; parent = parent.parentElement) {
    const { overflowY } = getComputedStyle(parent);
    if (overflowY === "auto" || overflowY === "scroll") return parent;
  }
  return null;
}

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
  getItemKey,
}: {
  listKey: CardsListKey;
  rows: Row[];
  estimateSize: (index: number) => number;
  overscan: number;
  getItemKey?: (index: number) => string | number;
}) {
  const listRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const focusedIndexRef = useRef<number | null>(null);
  const [scrollMargin, setScrollMargin] = useState(0);
  const [hasKeyboardFocus, setHasKeyboardFocus] = useState(false);
  const navigationType = useNavigationType();
  const [restoreOffset] = useState(() =>
    navigationType === "POP" ? recallScrollOffset(listKey) : undefined,
  );

  const getScrollElement = useCallback(() => {
    if (scrollerRef.current === null && listRef.current !== null) {
      scrollerRef.current = findScrollParent(listRef.current);
    }
    return scrollerRef.current;
  }, []);

  const rangeExtractor = useCallback(
    (range: Range) =>
      includeFocusedIndex(defaultRangeExtractor(range), focusedIndexRef.current, range.count),
    [],
  );

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement,
    estimateSize,
    overscan,
    getItemKey,
    scrollMargin,
    rangeExtractor,
    initialOffset: restoreOffset,
    // The scroller is unknown until mount; the viewport is a close stand-in, so the very first
    // render already holds the opening rows instead of waiting a deferred pass for them.
    initialRect: { width: 0, height: window.innerHeight },
    useFlushSync: false,
  });

  // Re-read only when a box around the list resizes — anything above it growing or shrinking
  // resizes them — never per scroll frame, where the read would force a layout every frame.
  useLayoutEffect(() => {
    const list = listRef.current;
    const scroller = getScrollElement();
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
  }, [getScrollElement]);

  useLayoutEffect(() => {
    const scroller = getScrollElement();
    if (scroller === null) return;
    if (restoreOffset !== undefined) scroller.scrollTop = restoreOffset;
    return () => {
      lastListScroll = { listKey, offset: scroller.scrollTop };
    };
  }, [getScrollElement, listKey, restoreOffset]);

  useEffect(() => {
    const list = listRef.current;
    if (list === null) return;
    const handleFocusIn = (event: FocusEvent) => {
      focusedIndexRef.current = readIndexOf(event.target);
      setHasKeyboardFocus(
        event.target instanceof Element && event.target.matches(":focus-visible"),
      );
    };
    const handleFocusOut = (event: FocusEvent) => {
      if (list.contains(event.relatedTarget as Node | null)) return;
      focusedIndexRef.current = null;
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
  // Rows a scroll brings in mount in an interruptible render, so a fling never blocks a frame;
  // the snapshot keeps each item paired with the rows it indexed. Keyboard focus walking the
  // list cannot wait for that pass, or Tab would run off the end of the rendered rows.
  const deferredSnapshot = useDeferredValue(snapshot);
  const shown = hasKeyboardFocus ? snapshot : deferredSnapshot;
  const spacers = computeSpacers(shown.items, shown.totalSize, scrollMargin);
  const slots = shown.items.map((item, position) => ({
    key: item.key,
    index: item.index,
    row: shown.rows[item.index],
    gapPx: spacers.gaps[position],
  }));

  return { virtualizer, listRef, slots, spacers };
}
