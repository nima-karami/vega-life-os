import type { Modal } from "@heroui/react";
import { useEffect, useState } from "react";

type ContainerProps = Modal["ContainerProps"];

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
