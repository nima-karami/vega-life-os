import { useState } from "react";
import { formatShortDate } from "@/core/lib/date";
import { Button, cx, Panel, SectionHead } from "@/core/ui";
import type { Review } from "./model";

/** Advisory cap for the past-reviews list — "show more" reveals the rest. */
const PAST_PAGE = 50;

export function PastReviewsPanel({
  reviews,
  activeKey,
  onOpen,
}: {
  reviews: Review[];
  activeKey: string;
  onOpen: (periodKey: string) => void;
}) {
  const [shown, setShown] = useState(PAST_PAGE);
  return (
    <Panel className="p-4 sm:p-5">
      <SectionHead title="Past reviews" meta={String(reviews.length)} />
      <div className="mt-3 space-y-1.5">
        {reviews.slice(0, shown).map((r) => (
          <button
            type="button"
            key={r.id}
            aria-current={r.periodKey === activeKey ? "true" : undefined}
            onClick={() => onOpen(r.periodKey)}
            className={cx(
              "flex w-full items-center gap-3 rounded-[12px] border px-3 py-2 text-left transition-colors hover:border-accent",
              r.periodKey === activeKey ? "border-accent" : "border-border",
            )}
          >
            <span className="shrink-0 text-sm text-foreground">
              Week of {formatShortDate(r.periodKey)}
            </span>
            <span className="ml-auto truncate text-xs text-muted">
              {r.prompts.find((p) => p.a)?.a ?? "No answers"}
            </span>
          </button>
        ))}
      </div>
      {reviews.length > shown && (
        <div className="mt-3 flex justify-center">
          <Button onPress={() => setShown((n) => n + PAST_PAGE)}>
            Show more ({reviews.length - shown})
          </Button>
        </div>
      )}
    </Panel>
  );
}
