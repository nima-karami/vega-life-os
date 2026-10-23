import { computeCarryVector } from "../gratitude-carry";

/** Today's journal pill wears the target attribute; the carry marks it landing so it pops. */
const CARRY_TARGET_SELECTOR = "[data-gratitude-target]";
const CARRY_LANDING_ATTR = "data-gratitude-landing";

let measureContext: CanvasRenderingContext2D | null = null;

function measureTextWidth(text: string, style: CSSStyleDeclaration): number {
  measureContext ??= document.createElement("canvas").getContext("2d");
  if (!measureContext) return 0;
  measureContext.font = `${style.fontWeight} ${style.fontSize} ${style.fontFamily}`;
  return measureContext.measureText(text).width;
}

function aimLine(line: HTMLTextAreaElement, target: DOMRect, lineIndex: number) {
  const style = getComputedStyle(line);
  const paddingLeft = Number.parseFloat(style.paddingLeft);
  const contentWidth = line.clientWidth - paddingLeft - Number.parseFloat(style.paddingRight);
  const vector = computeCarryVector(
    line.getBoundingClientRect(),
    {
      insetLeft: paddingLeft + Number.parseFloat(style.borderLeftWidth),
      width: Math.min(measureTextWidth(line.value, style), contentWidth),
    },
    target,
    lineIndex,
  );
  line.style.transformOrigin = `${vector.originX}px ${vector.originY}px`;
  line.style.setProperty("--carry-x", `${vector.dx}px`);
  line.style.setProperty("--carry-y", `${vector.dy}px`);
  line.style.setProperty("--carry-delay", `${vector.delayMs}ms`);
}

/** Aims every written line at the pill; false when the route the page lands on has none. */
export function aimCarry(layer: HTMLElement): boolean {
  const target = document.querySelector<HTMLElement>(CARRY_TARGET_SELECTOR);
  if (!target) return false;
  const targetBox = target.getBoundingClientRect();
  const writtenLines = [...layer.querySelectorAll("textarea")].filter((line) => line.value !== "");
  for (const [i, line] of writtenLines.entries()) aimLine(line, targetBox, i);
  target.setAttribute(CARRY_LANDING_ATTR, "");
  return true;
}
