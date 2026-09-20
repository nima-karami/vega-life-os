import { Card } from "@heroui/react";
import { useNowMs } from "@/core/lib/clock";
import { addMinutes } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { cx, getValueStripeStyle, Icon, Lineage, ROW_META_CLASS } from "@/core/ui";
import type { CalendarEvent } from "@/features/calendar-sync";
import { hasEventEnded } from "../today-logic";

/**
 * A lived (Google) event on Today. Same shell as a TaskCard, but it carries the
 * calendar glyph where a task carries its done-toggle — attendance is not
 * completion, so there is nothing here to tick. Click opens the event editor.
 *
 * The minute clock is subscribed here rather than on the page so only the event
 * rows re-render as the day passes them. `dimWhenPast` is off on any day but
 * today, where dimming would grey every event or none and mean nothing either way.
 */
export function EventCard({
  event,
  dimWhenPast,
  zone,
  onOpen,
}: {
  event: CalendarEvent;
  dimWhenPast: boolean;
  zone: string;
  onOpen: (e: CalendarEvent) => void;
}) {
  const nowMs = useNowMs();
  const value = useStore((s) => s.values.find((v) => v.id === event.valueId));
  const goal = useStore((s) => s.goals.find((g) => g.id === event.goalId));
  const isPast = dimWhenPast && hasEventEnded(event, nowMs, zone);
  const lineage = { value, goal, fromHabit: false };
  const isTimed = event.time != null;
  const span = isTimed
    ? `${event.time} – ${addMinutes(event.time ?? "", event.durationMin)}`
    : "All day";

  return (
    <Card
      className={cx(
        "relative flex flex-row rounded-[16px] border border-border bg-surface py-3 pe-3 ps-4",
        isPast && "opacity-60",
      )}
      style={getValueStripeStyle(lineage)}
    >
      <button
        type="button"
        data-event-id={event.id}
        onClick={() => onOpen(event)}
        aria-label={`${event.title}, ${span}, from Google`}
        className="flex w-full flex-row items-start gap-3 text-left"
      >
        <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center text-muted">
          <Icon name="calendar" size={14} />
        </span>
        <span className="flex min-w-0 flex-1 flex-col items-start gap-1">
          <span className="w-full truncate text-sm text-foreground">{event.title}</span>
          <span className={ROW_META_CLASS}>
            {(value || goal) && <Lineage lineage={lineage} variant="card" />}
            <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted">
              {isTimed && <Icon name="clock" size={11} />}
              {span}
            </span>
          </span>
        </span>
      </button>
    </Card>
  );
}
