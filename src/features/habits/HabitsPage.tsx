import { useEffect, useState } from "react";
import { useStore } from "@/core/store";
import { cx, Panel, Label, Icon, Button, TimeRange, Select, NONE } from "@/core/ui";
import { habitStreak, habitRate, habitHistory } from "./selectors";

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];

function recurrenceLabel(days: number[]): string {
  const on = days.map((d, i) => (d ? i : -1)).filter((i) => i >= 0);
  if (on.length === 7) return "Every day";
  if (on.length === 0) return "Never";
  if (on.join() === "0,1,2,3,4") return "Weekdays";
  if (on.join() === "5,6") return "Weekends";
  const names = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return on.map((i) => names[i]).join(" / ");
}

export function HabitsPage() {
  const habits = useStore((s) => s.habits);
  const tasks = useStore((s) => s.tasks);
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const addHabit = useStore((s) => s.addHabit);
  const updateHabit = useStore((s) => s.updateHabit);
  const removeHabit = useStore((s) => s.removeHabit);

  // after adding, focus + scroll to the new (top) habit so it's never buried below the fold
  const [newId, setNewId] = useState<string | null>(null);
  useEffect(() => {
    if (!newId) return;
    const el = document.querySelector<HTMLInputElement>(`[data-habit-name="${newId}"]`);
    el?.focus();
    el?.scrollIntoView({ block: "center", behavior: "smooth" });
    setNewId(null);
  }, [newId]);

  return (
    <div className="mx-auto max-w-[1100px] p-4">
      <Panel className="mb-4 flex items-center px-5 py-4">
        <div>
          <Label>// habits · recurrence</Label>
          <h1 className="display mt-1 text-3xl">The things you repeat</h1>
          <p className="mono mt-1 text-[11px] text-stone">
            Streaks reward consistency. A skipped day is neutral; a missed day breaks the chain.
          </p>
        </div>
        <Button className="ml-auto" icon="plus" onClick={() => setNewId(addHabit().id)}>Add habit</Button>
      </Panel>

      <div className="space-y-3">
        {habits.map((h) => {
          const value = values.find((v) => v.id === h.valueId);
          const streak = habitStreak(tasks, h.id);
          const rate = habitRate(tasks, h.id);
          const history = habitHistory(tasks, h.id, 28);
          return (
            <Panel key={h.id} className="p-4">
              <div className="flex flex-wrap items-start gap-4">
                {/* identity */}
                <div className="flex min-w-[240px] flex-1 items-start gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full" style={{ background: value?.hue ?? "var(--color-mist)" }}>
                    <Icon name={h.icon} size={16} className="text-paper" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <input
                      data-habit-name={h.id}
                      value={h.name}
                      onChange={(e) => updateHabit(h.id, { name: e.target.value })}
                      className="display w-full bg-transparent text-lg leading-tight outline-none"
                    />
                    <div className="mt-1.5 flex flex-wrap items-center gap-2">
                      <div className="min-w-[104px] border border-[var(--color-line)] px-2 py-1">
                        <Select
                          ariaLabel="Value"
                          value={h.valueId || NONE}
                          onValueChange={(v) => updateHabit(h.id, { valueId: v === NONE ? "" : v })}
                          options={[{ value: NONE, label: "No value" }, ...values.map((v) => ({ value: v.id, label: v.name, hue: v.hue }))]}
                        />
                      </div>
                      <div className="min-w-[104px] border border-[var(--color-line)] px-2 py-1">
                        <Select
                          ariaLabel="Goal"
                          value={h.goalId || NONE}
                          onValueChange={(v) => updateHabit(h.id, { goalId: v === NONE ? null : v })}
                          options={[{ value: NONE, label: "No goal" }, ...goals.map((g) => ({ value: g.id, label: g.name }))]}
                        />
                      </div>
                      <span className="mono ml-1 text-[10px] text-stone">{recurrenceLabel(h.days)}</span>
                    </div>
                  </div>
                </div>

                {/* day toggles + time */}
                <div className="flex flex-col gap-2">
                  <div className="flex gap-1">
                    {DAYS.map((d, i) => {
                      const on = !!h.days[i];
                      return (
                        <button
                          key={i}
                          onClick={() => {
                            const days = [...h.days];
                            days[i] = on ? 0 : 1;
                            updateHabit(h.id, { days, recurrence: recurrenceLabel(days) });
                          }}
                          className={cx("mono grid h-7 w-7 place-items-center border text-[10px]", on ? "border-ink bg-ink text-paper" : "border-[var(--color-line)] text-mist hover:border-ink")}
                        >
                          {d}
                        </button>
                      );
                    })}
                  </div>
                  <div className="w-[230px]">
                    <TimeRange
                      label="default block"
                      value={{ time: h.time, durationMin: h.durationMin }}
                      clearable={false}
                      onChange={({ time, durationMin }) => updateHabit(h.id, { time: time ?? h.time, durationMin })}
                    />
                  </div>
                </div>

                {/* stats */}
                <div className="flex items-center gap-5">
                  <div className="text-center">
                    <p className="display text-2xl leading-none">{streak}</p>
                    <Label>streak</Label>
                  </div>
                  <div className="text-center">
                    <p className="display text-2xl leading-none">{Math.round(rate * 100)}<span className="text-sm">%</span></p>
                    <Label>rate</Label>
                  </div>
                  <button onClick={() => removeHabit(h.id)} aria-label="Delete habit" className="text-mist hover:text-signal">
                    <Icon name="trash" size={15} />
                  </button>
                </div>
              </div>

              {/* heatmap */}
              <div className="mt-3 flex items-center gap-2 border-t border-[var(--color-line)] pt-3">
                <Label>28d</Label>
                <div className="flex flex-1 flex-wrap gap-1">
                  {history.map((v, i) => (
                    <span
                      key={i}
                      title={v === 1 ? "done" : v === -1 ? "skipped" : "missed"}
                      className="h-3.5 w-3.5"
                      style={{
                        background: v === 1 ? "var(--color-ink)" : v === -1 ? "var(--color-line-strong)" : "transparent",
                        border: v === 0 ? "1px solid var(--color-line)" : "none",
                      }}
                    />
                  ))}
                  {!history.length && <span className="mono text-[10px] text-mist">no history yet</span>}
                </div>
              </div>
            </Panel>
          );
        })}
      </div>
    </div>
  );
}
