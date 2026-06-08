import { useMemo, useState } from "react";
import { addDays } from "date-fns";
import { useStore } from "@/core/store";
import { cx, Panel, Label, Button, IconButton, Icon, Tag } from "@/core/ui";
import { weekDays, weekStartOf, minutesOf, fmtShort } from "@/core/lib/date";
import { TaskDrawer } from "@/features/tasks";
import { dowIndex } from "@/core/lib/date";
import type { Task } from "@/features/tasks";

const START = 5 * 60;
const END = 23 * 60;
const HOUR_PX = 46;
const HOURS = Array.from({ length: (END - START) / 60 + 1 }, (_, i) => 5 + i);

export function CalendarPage() {
  const tasks = useStore((s) => s.tasks);
  const habits = useStore((s) => s.habits);
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const addTask = useStore((s) => s.addTask);
  const pushToast = useStore((s) => s.pushToast);
  const focusGoalId = useStore((s) => s.focusGoalId);
  const setFocusGoal = useStore((s) => s.setFocusGoal);

  const [weekRef, setWeekRef] = useState(() => new Date());
  const [selected, setSelected] = useState<Task | null>(null);

  const days = useMemo(() => weekDays(weekRef), [weekRef]);
  const hueOf = (vId: string | null) =>
    values.find((v) => v.id === vId)?.hue ?? "var(--color-mist)";

  const generateWeek = () => {
    const existing = new Set(
      tasks.filter((t) => t.habitId).map((t) => `${t.habitId}@${t.date}`),
    );
    let made = 0;
    for (const d of days) {
      const dow = dowIndex(d.iso);
      for (const h of habits) {
        if (!h.days[dow]) continue;
        if (existing.has(`${h.id}@${d.iso}`)) continue;
        addTask({
          title: h.name, kind: "habit", habitId: h.id, goalId: h.goalId,
          valueId: h.valueId, date: d.iso, time: h.time,
          durationMin: h.durationMin, status: "todo",
        });
        made++;
      }
    }
    pushToast(made ? `Generated ${made} habit blocks` : "Week already complete");
  };

  return (
    <div className="mx-auto max-w-[1400px] p-4">
      <Panel className="mb-4 flex flex-wrap items-center gap-4 px-5 py-4">
        <div>
          <Label>// calendar · week</Label>
          <h1 className="display mt-1 text-3xl">
            {fmtShort(days[0].iso)} – {fmtShort(days[6].iso)}
          </h1>
          <p className="mono mt-1 text-[11px] text-stone">
            habit instances + scheduled tasks
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <IconButton name="chevL" label="Previous week" onClick={() => setWeekRef(addDays(weekStartOf(weekRef), -7))} />
          <Button onClick={() => setWeekRef(new Date())}>Today</Button>
          <IconButton name="chevR" label="Next week" onClick={() => setWeekRef(addDays(weekStartOf(weekRef), 7))} />
          <Button solid icon="flash" onClick={generateWeek}>Generate week</Button>
        </div>
      </Panel>

      {/* focus filter */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Label>focus</Label>
        <button
          onClick={() => setFocusGoal(null)}
          className={cx("mono border px-2.5 py-1 text-[10px] uppercase tracking-[0.1em]",
            !focusGoalId ? "border-ink bg-ink text-paper" : "border-[var(--color-line)] text-stone")}
        >
          All
        </button>
        {goals.map((g) => (
          <button key={g.id} onClick={() => setFocusGoal(focusGoalId === g.id ? null : g.id)}
            className={cx("mono flex items-center gap-1.5 border px-2.5 py-1 text-[10px] uppercase tracking-[0.08em]",
              focusGoalId === g.id ? "border-ink bg-ink text-paper" : "border-[var(--color-line)] text-stone")}>
            <span className="h-2 w-2 rounded-full" style={{ background: hueOf(g.valueId) }} />
            {g.name}
          </button>
        ))}
      </div>

      <Panel className="overflow-hidden">
        {/* day headers */}
        <div className="grid border-b border-[var(--color-line)]" style={{ gridTemplateColumns: `52px repeat(7, 1fr)` }}>
          <div />
          {days.map((d) => (
            <div key={d.iso} className={cx("border-l border-[var(--color-line)] px-2 py-2", d.today && "bg-paper-3")}>
              <span className="mono text-[10px] uppercase tracking-[0.1em] text-stone">{d.dow}</span>
              <span className={cx("display ml-1.5 text-lg", d.today && "text-ink")}>
                {String(d.dom).padStart(2, "0")}
              </span>
              {d.today && <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-signal align-middle" />}
            </div>
          ))}
        </div>

        {/* grid body */}
        <div className="relative overflow-y-auto" style={{ maxHeight: "calc(100vh - 320px)" }}>
          <div className="grid" style={{ gridTemplateColumns: `52px repeat(7, 1fr)`, height: HOURS.length * HOUR_PX }}>
            {/* hour gutter */}
            <div className="relative">
              {HOURS.map((h, i) => (
                <div key={h} className="absolute right-1.5" style={{ top: i * HOUR_PX - 5 }}>
                  <span className="mono text-[9px] tabular-nums text-mist">{String(h).padStart(2, "0")}:00</span>
                </div>
              ))}
            </div>

            {/* day columns */}
            {days.map((d) => {
              const dayTasks = tasks.filter((t) => t.date === d.iso && t.time);
              return (
                <div key={d.iso} className={cx("relative border-l border-[var(--color-line)]", d.today && "bg-paper-2/40")}>
                  {/* hour lines */}
                  {HOURS.map((h, i) => (
                    <div key={h} className="absolute left-0 right-0 border-t border-[var(--color-line-soft)]" style={{ top: i * HOUR_PX }} />
                  ))}
                  {/* now line */}
                  {d.today && <NowLine />}
                  {/* task blocks */}
                  {dayTasks.map((t) => {
                    const top = ((minutesOf(t.time!) - START) / 60) * HOUR_PX;
                    const height = Math.max((t.durationMin / 60) * HOUR_PX - 2, 20);
                    const resolved = t.status === "done" || t.status === "skip";
                    const dim = focusGoalId && t.goalId !== focusGoalId;
                    return (
                      <button
                        key={t.id}
                        onClick={() => setSelected(t)}
                        className={cx(
                          "absolute left-0.5 right-0.5 overflow-hidden border-l-2 px-1.5 py-1 text-left transition-opacity",
                          resolved ? "bg-paper-3" : "bg-paper",
                          dim ? "opacity-25" : "opacity-100",
                        )}
                        style={{ top, height, borderColor: hueOf(t.valueId), boxShadow: "0 1px 0 var(--color-line)" }}
                      >
                        <span className={cx("mono block truncate text-[10px] leading-tight", resolved && "line-through")}>
                          {t.title}
                        </span>
                        {height > 34 && (
                          <span className="mono mt-0.5 block text-[8px] text-stone">{t.time}</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>
      </Panel>

      <div className="mt-2 flex items-center gap-3">
        <Tag>HABIT</Tag><span className="mono text-[10px] text-stone">recurring instance</span>
        <Icon name="flash" size={12} className="ml-3 text-stone" />
        <span className="mono text-[10px] text-stone">Generate week fills missing habit blocks</span>
      </div>

      <TaskDrawer task={selected} onClose={() => setSelected(null)} />
    </div>
  );
}

function NowLine() {
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  if (cur < START || cur > END) return null;
  const top = ((cur - START) / 60) * HOUR_PX;
  return (
    <div className="absolute left-0 right-0 z-10 flex items-center" style={{ top }}>
      <span className="h-1.5 w-1.5 rounded-full bg-signal" />
      <span className="h-px flex-1 bg-signal" />
    </div>
  );
}
