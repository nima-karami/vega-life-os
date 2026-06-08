import { useStore } from "@/core/store";
import { cx, Panel, Label, Icon, Button, Tag } from "@/core/ui";
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
        <Button className="ml-auto" icon="plus" onClick={() => addHabit()}>Add habit</Button>
      </Panel>

      <div className="space-y-3">
        {habits.map((h) => {
          const value = values.find((v) => v.id === h.valueId);
          const goal = goals.find((g) => g.id === h.goalId);
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
                      value={h.name}
                      onChange={(e) => updateHabit(h.id, { name: e.target.value })}
                      className="display w-full bg-transparent text-lg leading-tight outline-none"
                    />
                    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                      {value && <Tag active>{value.name.toUpperCase()}</Tag>}
                      {goal ? <Tag>→ {goal.name}</Tag> : <Tag>UPKEEP</Tag>}
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
                  <div className="flex items-center gap-2">
                    <Icon name="clock" size={13} className="text-stone" />
                    <input
                      type="time"
                      value={h.time}
                      onChange={(e) => updateHabit(h.id, { time: e.target.value })}
                      className="mono bg-transparent text-[12px] outline-none"
                    />
                    <span className="mono text-[10px] text-mist">· {h.durationMin}m</span>
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
