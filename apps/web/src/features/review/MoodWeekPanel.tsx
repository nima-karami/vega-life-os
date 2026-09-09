import { format } from "date-fns";
import { Link } from "react-router";
import { Panel, SectionHead } from "@/core/ui";
import { MOOD_LABEL } from "@/features/journal/model";
import { describeMoodDelta, type MoodWeek } from "./mood";

const DELTA_COPY = {
  above: (n: number) => `↑ ${n.toFixed(1)} above your 4-week average`,
  below: (n: number) => `↓ ${n.toFixed(1)} below your 4-week average`,
  par: () => "on par with your 4-week average",
} as const;

/** Full-height finger cell on a phone; back to a bare 16px pip from sm up. */
const DAY_CELL = "grid h-11 flex-1 place-items-center rounded-full sm:h-4 sm:w-4 sm:flex-none";
const DAY_LINK = `${DAY_CELL} outline-none focus-visible:ring-2 focus-visible:ring-accent`;

const moodTint = (mood: number) => ({
  background: "var(--color-accent)",
  opacity: 0.25 + (mood - 1) * 0.1875, // 1→.25 … 5→1
});

export function MoodWeekPanel({ week }: { week: MoodWeek }) {
  const delta = describeMoodDelta(week);
  const nearestLabel = week.weekAvg != null ? MOOD_LABEL[Math.round(week.weekAvg)] : null;
  const summary = `Mood this week: ${week.loggedCount} of 7 days logged${
    week.weekAvg != null ? `, average ${week.weekAvg.toFixed(1)}` : ""
  }`;
  return (
    <Panel className="p-4 sm:p-5">
      <SectionHead
        title="Mood"
        meta={week.loggedCount ? `${week.loggedCount} of 7 days` : "empty"}
      />
      <p className="sr-only">{summary}</p>
      <div className="mt-3 flex items-center gap-0 sm:gap-1.5">
        {week.days.map(({ iso, mood }) => {
          const dayLabel = format(new Date(`${iso}T00:00:00`), "EEE MMM d");
          return mood != null ? (
            <Link
              key={iso}
              to={`/journal/${iso}`}
              title={`${dayLabel} — ${MOOD_LABEL[mood]} (${mood})`}
              aria-label={`${dayLabel} — ${MOOD_LABEL[mood]} (${mood})`}
              className={DAY_LINK}
            >
              <span className="h-4 w-4 rounded-full" style={moodTint(mood)} />
            </Link>
          ) : (
            <span key={iso} aria-hidden title={dayLabel} className={DAY_CELL}>
              <span className="h-4 w-4 rounded-full border border-border" />
            </span>
          );
        })}
      </div>
      {week.weekAvg != null ? (
        <p className="mt-3 text-sm text-foreground">
          {week.weekAvg.toFixed(1)} · {nearestLabel}
          {delta && (
            <span className="ml-1 block text-xs text-muted">
              {DELTA_COPY[delta.direction](delta.amount)}
            </span>
          )}
        </p>
      ) : (
        <p className="mt-3 text-sm text-muted">No mood logged this week.</p>
      )}
    </Panel>
  );
}
