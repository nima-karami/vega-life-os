import type { Box } from "../geometry";

/** The rubber-band rectangle of a live marquee selection. */
export function MarqueeBox({ box }: { box: Box | null }) {
  if (!box) return null;
  return (
    <div
      className="pointer-events-none absolute z-40 rounded-[2px] border border-accent/40 bg-accent/10"
      style={{
        left: box.left,
        top: box.top,
        width: box.right - box.left,
        height: box.bottom - box.top,
      }}
    />
  );
}
