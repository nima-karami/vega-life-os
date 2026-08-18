/** Under `box-sizing: border-box` a height set from `scrollHeight` alone leaves no room
 *  for the element's own border, so the field scrolls by exactly that much. */
export function computeGrownHeight(scrollHeight: number, borderAdjustment: number): number {
  return scrollHeight + borderAdjustment;
}

/** Grow a textarea to fit its content — no clipping, no inner scroll, at any length. */
export function growToFitContent(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  const borderAdjustment = el.offsetHeight - el.clientHeight;
  el.style.height = `${computeGrownHeight(el.scrollHeight, borderAdjustment)}px`;
}
