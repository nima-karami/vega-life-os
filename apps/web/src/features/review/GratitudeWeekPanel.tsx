import { format } from "date-fns";
import { Panel } from "@/core/ui";
import type { DayEntry } from "@/features/journal/model";
import { listWeekGratitude } from "@/features/journal/selectors";

export function GratitudeWeekPanel({
  journal,
  weekStartISO,
}: {
  journal: DayEntry[];
  weekStartISO: string;
}) {
  const days = listWeekGratitude(journal, weekStartISO);
  if (days.length === 0) return null;
  return (
    <section aria-label="Grateful for this week">
      <Panel className="p-4 sm:p-5">
        <h3 className="text-sm font-medium text-foreground">Grateful for this week</h3>
        <ul className="mt-3 space-y-3">
          {days.map((day) => (
            <li key={day.date}>
              <span className="text-xs font-medium text-muted">
                {format(new Date(`${day.date}T00:00:00`), "EEEE")}
              </span>
              <ul className="mt-0.5 space-y-0.5">
                {day.items.map((item) => (
                  <li key={item.slot} className="break-words text-sm text-foreground">
                    {item.text}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      </Panel>
    </section>
  );
}
