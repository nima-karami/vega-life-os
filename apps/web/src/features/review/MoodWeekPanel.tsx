import { format } from "date-fns";
import { Link } from "react-router-dom";
import { Panel, SectionHead } from "@/core/ui";
import { MOOD_LABEL } from "@/features/journal/model";
import { describeMoodDelta, type MoodWeek } from "./mood";

const DELTA_COPY = {
  above: (n: number) => `↑ ${n.toFixed(1)} above your 4-week average`,
  below: (n: number) => `↓ ${n.toFixed(1)} below your 4-week average`,
  par: () => "on par with your 4-week average",
} as const;

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
    <Panel className="p-5">
      <SectionHead
        title="mood"
        meta={week.loggedCount ? `${week.loggedCount} of 7 days` : "empty"}
      />
      <p className="sr-only">{summary}</p>
      <div className="mt-3 flex items-center gap-1.5">
        {week.days.map(({ iso, mood }) => {
          const dayLabel = format(new Date(`${iso}T00:00:00`), "EEE MMM d");
          return mood != null ? (
            <Link
              key={iso}
              to={`/journal/${iso}`}
              title={`${dayLabel} — ${MOOD_LABEL[mood]} (${mood})`}
              aria-label={`${dayLabel} — ${MOOD_LABEL[mood]} (${mood})`}
              className="h-4 w-4 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent"
              style={moodTint(mood)}
            />
          ) : (
            <span
              key={iso}
              aria-hidden
              title={dayLabel}
              className="h-4 w-4 rounded-full border border-border"
            />
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
