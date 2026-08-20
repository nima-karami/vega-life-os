export function describeBounceHint(isLearnable: boolean, clearedToday: boolean): string | null {
  if (!isLearnable) return "Not in spaced repetition";
  if (clearedToday) return "Reviewed today";
  return null;
}

/** Sits low rather than centred: a declined gesture explains itself without covering the card. */
export function StudyBounceHint({ text }: { text: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-28 z-30 flex justify-center px-6">
      <span className="rounded-full bg-ink/80 px-4 py-1.5 font-medium text-[12px] text-background">
        {text}
      </span>
    </div>
  );
}
