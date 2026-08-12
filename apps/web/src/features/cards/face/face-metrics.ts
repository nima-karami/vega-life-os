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
export const FULL_BLEED_PADDING = { top: 64, sides: 30, bottom: 78 };

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
  quoteMark: FaceQuoteMarkPlan | null;
};

export type FaceRulePlan = { key: string; kind: "rule"; width: number; marginY: number };

export type FacePlanItem = FaceTextPlan | FaceRulePlan;

export type FacePlan = {
  padding: { top: number; sides: number; bottom: number };
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

export function planFace(spec: FaceSpec, scale: number, fullBleed: boolean): FacePlan {
  const side = resolveSide(spec.signature, spec.side);
  const isSoloTitle = spec.blocks.length === 1 && spec.blocks[0].kind === "title";
  const padding = fullBleed ? FULL_BLEED_PADDING : CARD_PADDING;
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
    items.push({
      key: `${index}-${block.kind}`,
      kind: block.kind,
      text: block.text,
      fontSize: scaleType(metric.size, scale),
      fontWeight: metric.weight,
      lineHeight: metric.lineHeight,
      letterSpacing: metric.tracking,
      marginTop: isFirstRendered ? 0 : scaleSpace(metric.marginTop, scale),
      tone: metric.tone,
      isMono: block.kind === "mono",
      isCaps: block.kind === "caps",
      quoteMark: pendingQuoteMark,
    });
    pendingQuoteMark = null;
    isFirstRendered = false;
  }

  return {
    padding: {
      top: scaleSpace(padding.top, scale),
      sides: scaleSpace(padding.sides, scale),
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
