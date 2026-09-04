import type { SignatureId } from "@vega/shared";
import type { FaceBlock, FaceSide, FaceSpec } from "./compose";

export type FaceTone = "ink" | "ink-secondary" | "muted" | "ink-faint";

type BlockMetric = {
  size: number;
  weight: number;
  lineHeight: number;
  tracking: string;
  marginTop: number;
  tone: FaceTone;
  offsetTop?: number;
};

type SideMetrics = {
  blocks: Partial<Record<FaceBlock["kind"], BlockMetric>>;
  soloTitle?: BlockMetric;
};

const MIN_TYPE_PX = 8;
const RULE = { width: 34, marginY: 22 };
const CARD_PADDING = { top: 44, sides: 30, bottom: 44 };

export const FACE_HEADER = { gap: 10, size: 9.5, tracking: ".06em" };

const WIDE_FULL_BLEED_PADDING = { top: 64, left: 30, right: 30, bottom: 78 };

export const FULL_BLEED_SIDE_PX = 30;
export const HEADER_TOP_INSET_PX = 64;
// FaceHeaderRow's category label is whitespace-nowrap and the type label is a short
// fixed vocabulary, so the row is always exactly one line — safe to fix, not measure.
const HEADER_ROW_HEIGHT_PX = 18;
const HEADER_CONTENT_GAP_PX = FACE_HEADER.gap;
const HEADER_MIN_CLEARANCE_PX = HEADER_TOP_INSET_PX + HEADER_ROW_HEIGHT_PX + HEADER_CONTENT_GAP_PX;

export const NAV_SAFE_MARGIN_PX = 12;
export const TERM_FIT_FLOOR_PX = 28;

export const NAV_CLEARANCE_FALLBACK_PX = 58;

// Inter 600 / -.045em measured in Chrome: per-word averages ran .44–.55 of the font size, so .52
// sits above the long-word mean — an estimate that never undershoots a term into overflowing.
const TERM_AVG_GLYPH_WIDTH_RATIO = 0.52;

export type FacePadding = { top: number; left: number; right: number; bottom: number };

export function resolveVerticalInset(navClearancePx: number): number {
  return Math.max(HEADER_MIN_CLEARANCE_PX, navClearancePx + NAV_SAFE_MARGIN_PX);
}

export function resolveFullBleedPadding(
  narrow: boolean,
  navClearancePx: number = NAV_CLEARANCE_FALLBACK_PX,
): FacePadding {
  if (!narrow) return WIDE_FULL_BLEED_PADDING;
  const vertical = resolveVerticalInset(navClearancePx);
  return {
    top: vertical,
    bottom: vertical,
    left: FULL_BLEED_SIDE_PX,
    right: FULL_BLEED_SIDE_PX,
  };
}

export function fitTermFontSize(
  text: string,
  columnWidthPx: number,
  baseFontSizePx: number,
): { fontSize: number; wraps: boolean } {
  const glyphCount = [...text].length;
  const naturalWidth = glyphCount * baseFontSizePx * TERM_AVG_GLYPH_WIDTH_RATIO;
  if (naturalWidth <= columnWidthPx) return { fontSize: baseFontSizePx, wraps: false };
  const fitted = columnWidthPx / (glyphCount * TERM_AVG_GLYPH_WIDTH_RATIO);
  if (fitted >= TERM_FIT_FLOOR_PX) return { fontSize: fitted, wraps: false };
  return { fontSize: TERM_FIT_FLOOR_PX, wraps: true };
}

const CAPS_META: BlockMetric = {
  size: 9,
  weight: 500,
  lineHeight: 1.4,
  tracking: ".24em",
  marginTop: 0,
  tone: "muted",
};
const capsAt = (marginTop: number): BlockMetric => ({ ...CAPS_META, marginTop });

const FALLBACK_METRIC: BlockMetric = {
  size: 16,
  weight: 400,
  lineHeight: 1.6,
  tracking: "0",
  marginTop: 0,
  tone: "ink-secondary",
};

const FACE_METRICS: Record<SignatureId, { face: SideMetrics; reveal?: SideMetrics }> = {
  "term-gloss": {
    face: {
      blocks: {
        term: {
          size: 56,
          weight: 600,
          lineHeight: 1,
          tracking: "-.045em",
          marginTop: 0,
          tone: "ink",
        },
        mono: {
          size: 15,
          weight: 400,
          lineHeight: 1.4,
          tracking: "0",
          marginTop: 0,
          tone: "muted",
        },
      },
    },
    reveal: {
      blocks: {
        caps: capsAt(20),
        lead: {
          size: 22,
          weight: 400,
          lineHeight: 1.5,
          tracking: "-.016em",
          marginTop: 22,
          tone: "ink",
        },
        body: {
          size: 15,
          weight: 400,
          lineHeight: 1.6,
          tracking: "0",
          marginTop: 0,
          tone: "ink-secondary",
        },
      },
    },
  },
  "title-body": {
    face: {
      blocks: {
        title: {
          size: 34,
          weight: 600,
          lineHeight: 1.12,
          tracking: "-.04em",
          marginTop: 20,
          tone: "ink",
        },
        body: {
          size: 17,
          weight: 400,
          lineHeight: 1.66,
          tracking: "0",
          marginTop: 0,
          tone: "ink-secondary",
        },
      },
      soloTitle: {
        size: 42,
        weight: 600,
        lineHeight: 1.08,
        tracking: "-.042em",
        marginTop: 0,
        tone: "ink",
      },
    },
    reveal: {
      blocks: {
        caps: capsAt(0),
        lead: {
          size: 30,
          weight: 500,
          lineHeight: 1.3,
          tracking: "-.03em",
          marginTop: 22,
          tone: "ink",
        },
        body: {
          size: 16,
          weight: 400,
          lineHeight: 1.62,
          tracking: "0",
          marginTop: 0,
          tone: "ink-secondary",
        },
      },
    },
  },
  "body-author": {
    face: {
      blocks: {
        quoteMark: {
          size: 120,
          weight: 600,
          lineHeight: 1,
          tracking: "-.05em",
          marginTop: 0,
          tone: "ink-faint",
          offsetTop: -46,
        },
        lead: {
          size: 25,
          weight: 500,
          lineHeight: 1.42,
          tracking: "-.022em",
          marginTop: 0,
          tone: "ink",
        },
        caps: capsAt(0),
        body: {
          size: 13,
          weight: 400,
          lineHeight: 1.4,
          tracking: "0",
          marginTop: 8,
          tone: "muted",
        },
      },
    },
  },
  "body-source": {
    face: {
      blocks: {
        lead: {
          size: 23,
          weight: 400,
          lineHeight: 1.48,
          tracking: "-.018em",
          marginTop: 0,
          tone: "ink",
        },
        body: {
          size: 16,
          weight: 400,
          lineHeight: 1.64,
          tracking: "0",
          marginTop: 18,
          tone: "ink-secondary",
        },
        caps: capsAt(0),
      },
    },
  },
  "body-alone": {
    face: {
      blocks: {
        lead: {
          size: 27,
          weight: 500,
          lineHeight: 1.36,
          tracking: "-.025em",
          marginTop: 0,
          tone: "ink",
        },
        body: {
          size: 16,
          weight: 400,
          lineHeight: 1.62,
          tracking: "0",
          marginTop: 18,
          tone: "ink-secondary",
        },
        caps: capsAt(0),
      },
    },
  },
};

export type FaceQuoteMarkPlan = { fontSize: number; top: number; letterSpacing: string };

export type FaceTextPlan = {
  key: string;
  kind: "term" | "title" | "lead" | "body" | "mono" | "caps";
  text: string;
  fontSize: number;
  fontWeight: number;
  lineHeight: number;
  letterSpacing: string;
  marginTop: number;
  tone: FaceTone;
  isMono: boolean;
  isCaps: boolean;
  wraps: boolean;
  quoteMark: FaceQuoteMarkPlan | null;
  isSample?: true;
};

export type FaceRulePlan = {
  key: string;
  kind: "rule";
  width: number;
  marginY: number;
  isSample?: true;
};

export type FacePlanItem = FaceTextPlan | FaceRulePlan;

export type FacePlan = {
  padding: FacePadding;
  header: { gap: number; fontSize: number; tracking: string };
  items: FacePlanItem[];
};

const scaleType = (px: number, scale: number): number => Math.max(MIN_TYPE_PX, px * scale);
const scaleSpace = (px: number, scale: number): number => px * scale;

function resolveSide(signature: SignatureId, side: FaceSide): SideMetrics {
  const metrics = FACE_METRICS[signature];
  return side === "reveal" ? (metrics.reveal ?? metrics.face) : metrics.face;
}

function resolveMetric(
  side: SideMetrics,
  kind: FaceBlock["kind"],
  isSoloTitle: boolean,
): BlockMetric {
  if (kind === "title" && isSoloTitle && side.soloTitle !== undefined) return side.soloTitle;
  return side.blocks[kind] ?? FALLBACK_METRIC;
}

function resolveBasePadding(
  fullBleed: boolean,
  narrow: boolean,
  navClearancePx?: number,
): FacePadding {
  if (fullBleed) return resolveFullBleedPadding(narrow, navClearancePx);
  return {
    top: CARD_PADDING.top,
    left: CARD_PADDING.sides,
    right: CARD_PADDING.sides,
    bottom: CARD_PADDING.bottom,
  };
}

const sampleFlag = (block: FaceBlock): { isSample?: true } =>
  block.isSample === true ? { isSample: true } : {};

export function planFace(
  spec: FaceSpec,
  scale: number,
  fullBleed: boolean,
  narrow = false,
  columnWidthPx?: number,
  navClearancePx?: number,
): FacePlan {
  const side = resolveSide(spec.signature, spec.side);
  const isSoloTitle = spec.blocks.length === 1 && spec.blocks[0].kind === "title";
  const padding = resolveBasePadding(fullBleed, narrow, navClearancePx);
  const fitWidthPx =
    fullBleed && narrow && columnWidthPx !== undefined && columnWidthPx > 0
      ? columnWidthPx - padding.left - padding.right
      : null;
  const items: FacePlanItem[] = [];
  let isFirstRendered = true;
  let pendingQuoteMark: FaceQuoteMarkPlan | null = null;

  for (const [index, block] of spec.blocks.entries()) {
    if (block.kind === "rule") {
      items.push({
        key: `${index}-rule`,
        kind: "rule",
        width: scaleSpace(RULE.width, scale),
        marginY: scaleSpace(RULE.marginY, scale),
        ...sampleFlag(block),
      });
      isFirstRendered = false;
      continue;
    }
    const metric = resolveMetric(side, block.kind, isSoloTitle);
    if (block.kind === "quoteMark") {
      pendingQuoteMark = {
        fontSize: scaleType(metric.size, scale),
        top: scaleSpace(metric.offsetTop ?? 0, scale),
        letterSpacing: metric.tracking,
      };
      continue;
    }
    const fit =
      block.kind === "term" && fitWidthPx !== null
        ? fitTermFontSize(block.text, fitWidthPx, metric.size)
        : { fontSize: metric.size, wraps: false };
    items.push({
      key: `${index}-${block.kind}`,
      kind: block.kind,
      text: block.text,
      fontSize: scaleType(fit.fontSize, scale),
      fontWeight: metric.weight,
      lineHeight: metric.lineHeight,
      letterSpacing: metric.tracking,
      marginTop: isFirstRendered ? 0 : scaleSpace(metric.marginTop, scale),
      tone: metric.tone,
      isMono: block.kind === "mono",
      isCaps: block.kind === "caps",
      wraps: fit.wraps,
      quoteMark: pendingQuoteMark,
      ...sampleFlag(block),
    });
    pendingQuoteMark = null;
    isFirstRendered = false;
  }

  return {
    padding: {
      top: scaleSpace(padding.top, scale),
      left: scaleSpace(padding.left, scale),
      right: scaleSpace(padding.right, scale),
      bottom: scaleSpace(padding.bottom, scale),
    },
    header: {
      gap: scaleSpace(FACE_HEADER.gap, scale),
      fontSize: scaleType(FACE_HEADER.size, scale),
      tracking: FACE_HEADER.tracking,
    },
    items,
  };
}
