import { type RefObject, useEffect, useRef, useState } from "react";

/** Observed, not just listened to: a late badge or a webfont swap changes scrollWidth without firing scroll or resize. */
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
