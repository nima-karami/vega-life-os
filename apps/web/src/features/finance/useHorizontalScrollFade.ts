import { type RefObject, useEffect, useRef, useState } from "react";

/**
 * Whether a horizontal scroller still has content to its right. Measured, never inferred from a
 * breakpoint — and observed as well as listened to, because a badge arriving from store state or a
 * webfont swapping in changes the scroll width without firing scroll or resize.
 */
export function useHorizontalScrollFade<T extends HTMLElement>(): {
  scrollRef: RefObject<T | null>;
  hasMoreRight: boolean;
} {
  const scrollRef = useRef<T>(null);
  const [hasMoreRight, setHasMoreRight] = useState(false);

  useEffect(() => {
    const node = scrollRef.current;
    if (node === null) return;

    const measure = () =>
      setHasMoreRight(node.scrollLeft + node.clientWidth < node.scrollWidth - 1);
    measure();

    node.addEventListener("scroll", measure, { passive: true });
    window.addEventListener("resize", measure);

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    if (node.firstElementChild !== null) observer.observe(node.firstElementChild);

    return () => {
      node.removeEventListener("scroll", measure);
      window.removeEventListener("resize", measure);
      observer.disconnect();
    };
  }, []);

  return { scrollRef, hasMoreRight };
}
