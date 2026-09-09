import type { Modal } from "@heroui/react";
import { useEffect, useState } from "react";

type ContainerProps = Modal["ContainerProps"];

const COMPACT_QUERY = "(max-width: 639px)";
const BELOW_LARGE_QUERY = "(max-width: 1023px)";
const COARSE_POINTER_QUERY = "(pointer: coarse)";

function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(
    () => typeof window !== "undefined" && window.matchMedia(query).matches,
  );
  useEffect(() => {
    const mql = window.matchMedia(query);
    const onChange = () => setMatches(mql.matches);
    setMatches(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, [query]);
  return matches;
}

/** True while the viewport is compact (< sm). SSR-safe. */
export function useCompact(): boolean {
  return useMediaQuery(COMPACT_QUERY);
}

/** True when the primary pointer is a finger — the static proxy for touch-gated copy. */
export function useCoarsePointer(): boolean {
  return useMediaQuery(COARSE_POINTER_QUERY);
}

/** True below `lg` — where the card editor is a single column with no sticky aside. */
export function useBelowLarge(): boolean {
  return useMediaQuery(BELOW_LARGE_QUERY);
}

/**
 * Responsive HeroUI v3 Modal.Container props: a full-screen sheet on a phone
 * (inside-scrolling body, actions stay above the keyboard) and a centered dialog
 * on ≥ sm — desktop rendering is unchanged. Spread onto a `<Modal.Container>`;
 * pass `size` to override the centered (desktop) size.
 */
export function useCompactModal(
  size: ContainerProps["size"] = "md",
): Pick<ContainerProps, "size" | "scroll" | "placement"> {
  const compact = useCompact();
  return compact
    ? { size: "full", scroll: "inside", placement: "center" }
    : { size, scroll: "inside", placement: "center" };
}
