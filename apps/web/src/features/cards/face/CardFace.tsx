import type { ReactNode } from "react";
import { useLayoutEffect, useRef, useState } from "react";
import { cx, NAV_CLEARANCE_FALLBACK_PX } from "@/core/ui";
import type { FaceSpec } from "./compose";
import {
  type FacePlanItem,
  type FaceTone,
  FULL_BLEED_SIDE_PX,
  HEADER_TOP_INSET_PX,
  planFace,
} from "./face-metrics";

const LEFT_DOUBLE_QUOTE = "“";
const HAIRLINE_PX = 1;

const TONE_CLASS: Record<FaceTone, string> = {
  ink: "text-foreground",
  "ink-secondary": "text-ink-secondary",
  muted: "text-muted",
  "ink-faint": "text-foreground/10",
};

function HeaderLabel({
  text,
  fontSize,
  tracking,
  className,
}: {
  text: string;
  fontSize: number;
  tracking: string;
  className: string;
}) {
  return (
    <span className={cx("uppercase", className)} style={{ fontSize, letterSpacing: tracking }}>
      {text}
    </span>
  );
}

export function FaceHeaderRow({
  typeLabel,
  category,
  fontSize,
  tracking,
  gap,
  leading = null,
}: {
  typeLabel: string;
  category: string;
  fontSize: number;
  tracking: string;
  gap: number;
  leading?: ReactNode;
}) {
  return (
    <div className="flex items-center" style={{ gap }}>
      {leading}
      <HeaderLabel
        text={typeLabel}
        fontSize={fontSize}
        tracking={tracking}
        className="font-semibold text-foreground"
      />
      <span className="flex-1 bg-line-card" style={{ height: HAIRLINE_PX }} />
      {category !== "" && (
        <HeaderLabel
          text={category}
          fontSize={fontSize}
          tracking={tracking}
          className="whitespace-nowrap font-medium text-muted"
        />
      )}
    </div>
  );
}

function FaceItem({ item }: { item: FacePlanItem }) {
  if (item.kind === "rule") {
    return (
      <span
        data-sample={item.isSample === true ? "true" : undefined}
        className={cx("mx-auto block bg-line-strong", item.isSample === true && "opacity-40")}
        style={{
          width: item.width,
          height: HAIRLINE_PX,
          marginTop: item.marginY,
          marginBottom: item.marginY,
        }}
      />
    );
  }

  const paragraph = (
    <p
      data-sample={item.isSample === true ? "true" : undefined}
      className={cx(
        "relative text-pretty text-center",
        TONE_CLASS[item.tone],
        item.isMono && "font-mono",
        item.isCaps && "uppercase",
        item.wraps && "break-words",
        item.isSample === true && "opacity-40",
      )}
      style={{
        fontSize: item.fontSize,
        fontWeight: item.fontWeight,
        lineHeight: item.lineHeight,
        letterSpacing: item.letterSpacing,
      }}
    >
      {item.text}
    </p>
  );

  if (item.quoteMark === null) {
    return <div style={{ marginTop: item.marginTop }}>{paragraph}</div>;
  }

  return (
    <div className="relative" style={{ marginTop: item.marginTop }}>
      <span
        aria-hidden
        className={cx("-translate-x-1/2 absolute left-1/2 font-semibold", TONE_CLASS["ink-faint"])}
        style={{
          top: item.quoteMark.top,
          fontSize: item.quoteMark.fontSize,
          letterSpacing: item.quoteMark.letterSpacing,
          lineHeight: 1,
        }}
      >
        {LEFT_DOUBLE_QUOTE}
      </span>
      {paragraph}
    </div>
  );
}

export function CardFace({
  spec,
  scale,
  fullBleed = false,
  narrow = false,
  columnWidthPx,
  stageHeightPx,
  navClearancePx,
  headerLeading = null,
}: {
  spec: FaceSpec;
  scale: number;
  fullBleed?: boolean;
  narrow?: boolean;
  columnWidthPx?: number;
  stageHeightPx?: number;
  navClearancePx?: number;
  headerLeading?: ReactNode;
}) {
  const isNarrowFullBleed = narrow && fullBleed;
  const resolvedNavClearancePx = navClearancePx ?? NAV_CLEARANCE_FALLBACK_PX;
  const [contentBlockHeightPx, setContentBlockHeightPx] = useState<number | null>(null);
  const contentBlockRef = useRef<HTMLDivElement>(null);

  // Deliberately re-measured after every commit — the rendered block's height only exists
  // post-layout, and a new card, a flip, a refit and a resize all change it.
  useLayoutEffect(() => {
    if (!isNarrowFullBleed) return;
    const el = contentBlockRef.current;
    if (el === null) return;
    setContentBlockHeightPx(el.getBoundingClientRect().height);
  });

  const plan = planFace(
    spec,
    scale,
    fullBleed,
    narrow,
    columnWidthPx,
    isNarrowFullBleed ? resolvedNavClearancePx : undefined,
  );

  const header = (
    <FaceHeaderRow
      typeLabel={spec.typeLabel}
      category={spec.category}
      leading={headerLeading}
      fontSize={plan.header.fontSize}
      tracking={plan.header.tracking}
      gap={plan.header.gap}
    />
  );

  const items = plan.items.map((item) => <FaceItem key={item.key} item={item} />);

  if (!isNarrowFullBleed) {
    return (
      <div
        className="flex h-full w-full flex-col"
        style={{
          paddingTop: plan.padding.top,
          paddingBottom: plan.padding.bottom,
          paddingLeft: plan.padding.left,
          paddingRight: plan.padding.right,
        }}
      >
        {header}
        <div className="flex flex-1 flex-col justify-center">{items}</div>
      </div>
    );
  }

  // A degenerate short viewport (e.g. landscape) could make the vertical inset alone
  // exceed the stage — clamp each side to half the stage so the box never goes negative.
  const verticalInsetPx =
    stageHeightPx !== undefined && stageHeightPx > 0
      ? Math.min(plan.padding.top, stageHeightPx / 2)
      : plan.padding.top;
  const availableBoxHeightPx =
    stageHeightPx !== undefined && stageHeightPx > 0 ? stageHeightPx - 2 * verticalInsetPx : null;
  const isOversizedContent =
    contentBlockHeightPx !== null &&
    availableBoxHeightPx !== null &&
    contentBlockHeightPx > availableBoxHeightPx;

  return (
    <div className="relative h-full w-full">
      <div
        className="absolute inset-x-0 top-0"
        style={{
          paddingTop: HEADER_TOP_INSET_PX,
          paddingLeft: FULL_BLEED_SIDE_PX,
          paddingRight: FULL_BLEED_SIDE_PX,
        }}
      >
        {header}
      </div>
      <div
        className="flex h-full w-full flex-col"
        style={{
          paddingTop: verticalInsetPx,
          paddingBottom: verticalInsetPx,
          paddingLeft: plan.padding.left,
          paddingRight: plan.padding.right,
        }}
      >
        <div
          className={cx(
            "flex flex-1 flex-col",
            isOversizedContent ? "justify-start" : "justify-center",
          )}
        >
          <div ref={contentBlockRef}>{items}</div>
        </div>
      </div>
    </div>
  );
}
