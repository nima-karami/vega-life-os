import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { format, subDays } from "date-fns";
import { useStore } from "@/core/store";
import {
  Panel,
  SectionHead,
  Label,
  DotMeter,
  ProgressBar,
  Radar,
  Sparkline,
  Icon,
} from "@/core/ui";
import { todayISO, fmtLong } from "@/core/lib/date";
import { dayQueue, dayCounts, TaskRow, TaskDrawer } from "@/features/tasks";
import { habitStreak } from "@/features/habits";
import type { Task } from "@/features/tasks";

const OPERATOR = "Avery Quinn";

export function CockpitPage() {
  const tasks = useStore((s) => s.tasks);
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const habits = useStore((s) => s.habits);
  const [selected, setSelected] = useState<Task | null>(null);

  const today = todayISO();
  const queue = useMemo(() => dayQueue(tasks, today), [tasks, today]);
  const counts = dayCounts(tasks, today);

  // follow-through signal: last 14 days resolved fraction
  const signal = useMemo(() => {
    return Array.from({ length: 14 }, (_, i) => {
      const d = format(subDays(new Date(), 13 - i), "yyyy-MM-dd");
      const day = tasks.filter((t) => t.date === d);
      if (!day.length) return 0;
      return day.filter((t) => t.status === "done").length / day.length;
    });
  }, [tasks]);

  const radarBlips = useMemo(
    () =>
      queue.slice(0, 8).map((t, i) => ({
        angle: i / Math.max(queue.length, 1),
        radius: 0.3 + ((i * 37) % 60) / 100,
        on: t.status === "done",
      })),
    [queue],
  );

  return (
    <div className="mx-auto max-w-[1400px] p-4">
      {/* header band */}
      <Panel className="mb-4 px-5 py-4">
        <div className="flex items-end justify-between gap-4">
          <div>
            <Label>// today · orbit {format(new Date(), "MM.dd")}</Label>
            <h1 className="display mt-1 text-6xl leading-none">TODAY</h1>
            <p className="mono mt-2 text-[11px] text-stone">{fmtLong(today)}</p>
          </div>
          <div className="text-right">
            <div className="display text-5xl leading-none">
              {counts.done}
              <span className="text-2xl text-mist"> / {counts.total}</span>
            </div>
            <Label className="mt-1">tasks complete</Label>
          </div>
        </div>
        <DayRail />
      </Panel>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-[280px_minmax(0,1fr)_320px]">
        {/* LEFT */}
        <div className="space-y-4">
          <Panel ticks className="p-4">
            <SectionHead title="operator" meta="A-34" />
            <div className="mt-3 aspect-square w-full border border-[var(--color-line)] grain" style={{ backgroundImage: "repeating-linear-gradient(135deg, var(--color-line-soft) 0 6px, transparent 6px 12px)" }} />
            <h2 className="display mt-3 text-xl">{OPERATOR.toUpperCase()}</h2>
            <Label className="mt-0.5">personal workspace</Label>
            <div className="mt-3 grid grid-cols-3 gap-2">
              <Stat label="incept" value="2024" />
              <Stat label="goals" value={String(goals.length)} />
              <Stat label="habits" value={String(habits.length)} />
            </div>
          </Panel>

          <Panel className="p-4">
            <SectionHead title="values" meta={String(values.length).padStart(2, "0")} />
            <div className="mt-3 space-y-3">
              {values.map((v) => (
                <div key={v.id} className="flex items-center gap-2">
                  <Icon name={v.icon} size={13} className="shrink-0 text-ash" />
                  <span className="mono w-20 shrink-0 truncate text-[10px] uppercase tracking-[0.08em] text-ash">
                    {v.name}
                  </span>
                  <DotMeter value={v.energy} className="flex-1 justify-end" />
                  <span className="mono w-8 text-right text-[11px] tabular-nums text-stone">
                    {Math.round(v.energy * 100)}%
                  </span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* CENTER */}
        <Panel className="flex flex-col p-4">
          <SectionHead title="today · queue" meta={`${counts.done}/${counts.total} done`} />
          <div className="mt-1 divide-y divide-[var(--color-line)]">
            {queue.map((t) => (
              <TaskRow key={t.id} task={t} onOpen={setSelected} />
            ))}
            {!queue.length && (
              <p className="mono py-10 text-center text-[12px] text-mist">
                Nothing scheduled today. A clear runway.
              </p>
            )}
          </div>

          <div className="mt-5">
            <SectionHead title="signal · follow-through" meta="14d" />
            <div className="mt-2">
              <Sparkline points={signal} width={620} height={56} className="w-full" />
            </div>
          </div>
        </Panel>

        {/* RIGHT */}
        <div className="space-y-4">
          <Panel className="p-4">
            <div className="flex items-center justify-between">
              <SectionHead title="orbit · radar" className="flex-1" />
              <Link to="/map" className="mono ml-2 flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] text-stone hover:text-ink">
                open map <Icon name="chevR" size={12} />
              </Link>
            </div>
            <div className="mt-3 grid place-items-center">
              <Radar size={210} blips={radarBlips} />
            </div>
          </Panel>

          <Panel className="p-4">
            <SectionHead title="goals" meta="// strength" />
            <div className="mt-3 space-y-3.5">
              {goals.map((g) => (
                <div key={g.id}>
                  <div className="flex items-center justify-between">
                    <span className="mono text-[11px] uppercase tracking-[0.06em] text-ash">
                      <span className="text-stone">// </span>
                      {g.name}
                    </span>
                    <span className="mono text-[11px] tabular-nums text-stone">
                      {Math.round(g.progress * 100)}%
                    </span>
                  </div>
                  <ProgressBar value={g.progress} knob className="mt-2" />
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-4">
            <SectionHead title="habits" meta={String(habits.length)} />
            <div className="mt-3 grid grid-cols-2 gap-2">
              {habits.slice(0, 6).map((h) => (
                <div key={h.id} className="border border-[var(--color-line)] p-2.5">
                  <p className="mono truncate text-[10px] uppercase tracking-[0.06em] text-ash">
                    {h.name}
                  </p>
                  <p className="display mt-1 text-2xl leading-none">
                    {habitStreak(tasks, h.id)}
                    <span className="mono ml-1 align-middle text-[9px] tracking-[0.1em] text-stone">
                      DAY STREAK
                    </span>
                  </p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>

      <TaskDrawer task={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="border border-[var(--color-line)] px-2 py-1.5">
      <Label>{label}</Label>
      <p className="display text-lg leading-none">{value}</p>
    </div>
  );
}

function DayRail() {
  const now = new Date();
  const startMin = 5 * 60;
  const endMin = 23 * 60;
  const cur = now.getHours() * 60 + now.getMinutes();
  const pct = Math.min(100, Math.max(0, ((cur - startMin) / (endMin - startMin)) * 100));
  return (
    <div className="mt-4">
      <div className="relative h-px w-full bg-[var(--color-line)]">
        <div
          className="absolute -top-[2px] h-[5px] border-l border-ink"
          style={{ left: `${pct}%` }}
        />
        <div className="absolute left-0 top-0 h-px bg-ink/40" style={{ width: `${pct}%` }} />
      </div>
      <div className="mt-1.5 flex justify-between">
        <Label>05:00</Label>
        <Label>23:00</Label>
      </div>
    </div>
  );
}
