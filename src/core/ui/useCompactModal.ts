import type { ModalProps } from "@heroui/react";
import { useEffect, useState } from "react";

const COMPACT_QUERY = "(max-width: 639px)";

/** True while the viewport is compact (< sm). SSR-safe. */
export function useCompact(): boolean {
  const [compact, setCompact] = useState(
    () => typeof window !== "undefined" && window.matchMedia(COMPACT_QUERY).matches,
  );
  useEffect(() => {
    const mql = window.matchMedia(COMPACT_QUERY);
    const onChange = () => setCompact(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);
  return compact;
}

/**
 * Responsive HeroUI Modal props: a full-screen sheet on a phone (sticky header +
 * footer, inside-scrolling body, actions stay above the keyboard) and a centered
 * dialog on ≥ sm — desktop rendering is unchanged. Spread onto a `<Modal>`; pass
 * `size` to override the centered (desktop) size.
 */
export function useCompactModal(size: ModalProps["size"] = "md"): Partial<ModalProps> {
  const compact = useCompact();
  return compact
    ? { size: "full", scrollBehavior: "inside", placement: "center" }
    : { size, scrollBehavior: "inside", placement: "center" };
}
