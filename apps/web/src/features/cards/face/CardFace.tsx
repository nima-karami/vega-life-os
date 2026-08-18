import type { ReactNode } from "react";
import { cx } from "@/core/ui";
import type { FaceSpec } from "./compose";
import { type FacePlanItem, type FaceTone, planFace } from "./face-metrics";

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
        className="mx-auto block bg-line-strong"
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
      className={cx(
        "relative text-pretty text-center",
        TONE_CLASS[item.tone],
        item.isMono && "font-mono",
        item.isCaps && "uppercase",
        item.wraps && "break-words",
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
  headerLeading = null,
}: {
  spec: FaceSpec;
  scale: number;
  fullBleed?: boolean;
  narrow?: boolean;
  columnWidthPx?: number;
  headerLeading?: ReactNode;
}) {
  const plan = planFace(spec, scale, fullBleed, narrow, columnWidthPx);
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
      <FaceHeaderRow
        typeLabel={spec.typeLabel}
        category={spec.category}
        leading={headerLeading}
        fontSize={plan.header.fontSize}
        tracking={plan.header.tracking}
        gap={plan.header.gap}
      />
      <div className="flex flex-1 flex-col justify-center">
        {plan.items.map((item) => (
          <FaceItem key={item.key} item={item} />
        ))}
      </div>
    </div>
  );
}
