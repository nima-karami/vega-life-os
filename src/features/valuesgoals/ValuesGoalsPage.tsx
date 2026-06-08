import { useState } from "react";
import { useStore } from "@/core/store";
import { cx, Panel, Label, Icon, Gauge, ProgressBar, Button, Tag, Menu, ConfirmDialog } from "@/core/ui";
import { ValueDrawer } from "@/features/values";
import type { Value } from "@/features/values";
import { goalTimeElapsed, habitsForGoal, GoalDrawer, periodLabel, GOAL_STATUS_LABEL, isGoalClosed } from "@/features/goals";
import { habitStreak } from "@/features/habits";

export function ValuesGoalsPage() {
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const habits = useStore((s) => s.habits);
  const tasks = useStore((s) => s.tasks);
  const addValue = useStore((s) => s.addValue);
  const addGoal = useStore((s) => s.addGoal);
  const removeValue = useStore((s) => s.removeValue);
  const pushToast = useStore((s) => s.pushToast);

  const [editId, setEditId] = useState<string | null>(null);
  const [goalEditId, setGoalEditId] = useState<string | null>(null);
  const [confirmDel, setConfirmDel] = useState<Value | null>(null);
  const editValue = values.find((v) => v.id === editId) ?? null;

  const delCounts = confirmDel
    ? {
        goals: goals.filter((g) => g.valueId === confirmDel.id).length,
        habits: habits.filter((h) => h.valueId === confirmDel.id).length,
      }
    : null;

  return (
    <div className="mx-auto max-w-[1100px] p-4">
      <Panel className="mb-4 flex items-center px-5 py-4">
        <div>
          <Label>// values &amp; goals · the why</Label>
          <h1 className="display mt-1 text-3xl">What you're building toward</h1>
          <p className="mono mt-1 text-[11px] text-stone">
            Goals ladder up to a value — each with a timeframe and a state. Habits keep them moving.
          </p>
        </div>
        <Button className="ml-auto" icon="plus" onClick={() => setEditId(addValue().id)}>Add value</Button>
      </Panel>

      <div className="space-y-4">
        {values.map((v) => {
          const vGoals = goals
            .filter((g) => g.valueId === v.id)
            .sort((a, b) => (a.start < b.start ? -1 : a.start > b.start ? 1 : a.order - b.order));
          const valueHabits = habits.filter((h) => h.valueId === v.id && !h.goalId);
          return (
            <Panel key={v.id} ticks className="p-5">
              <div className="flex items-start gap-4">
                <button onClick={() => setEditId(v.id)} aria-label={`Edit ${v.name}`}
                  className="grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--color-line-strong)] transition-transform hover:scale-105" style={{ background: v.hue }}>
                  <Icon name={v.icon} size={20} className="text-paper" />
                </button>
                <button onClick={() => setEditId(v.id)} className="group min-w-0 flex-1 text-left">
                  <h2 className="display text-2xl leading-none group-hover:underline decoration-[var(--color-line-strong)] underline-offset-4">{v.name}</h2>
                  <p className="mono mt-1.5 text-[12px] leading-relaxed text-ash">{v.desc || <span className="text-mist">No description yet — click to add one.</span>}</p>
                </button>
                <Gauge value={v.energy} size={56} sub="energy" />
                <Menu
                  align="end"
                  trigger={
                    <button aria-label="Value actions" className="grid h-8 w-8 place-items-center text-stone hover:bg-ink hover:text-paper">
                      <Icon name="dots" size={16} />
                    </button>
                  }
                  items={[
                    { label: "Edit details", icon: "edit", onSelect: () => setEditId(v.id) },
                    { label: "Add goal", icon: "plus", onSelect: () => setGoalEditId(addGoal({ valueId: v.id }).id) },
                    { label: "Delete value", icon: "trash", danger: true, onSelect: () => setConfirmDel(v) },
                  ]}
                />
              </div>

              {/* goals */}
              <div className="mt-5 space-y-3">
                <div className="flex items-center gap-3">
                  <Label ink>// goals</Label>
                  <div className="h-px flex-1 bg-[var(--color-line)]" />
                  <button onClick={() => setGoalEditId(addGoal({ valueId: v.id }).id)} className="mono flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] text-stone hover:text-ink">
                    <Icon name="plus" size={12} /> add goal
                  </button>
                </div>
                {vGoals.map((g) => (
                  <GoalCard key={g.id} goalId={g.id} onEdit={setGoalEditId} />
                ))}
                {!vGoals.length && (
                  <p className="mono py-2 text-[11px] text-mist">No goals yet.</p>
                )}
              </div>

              {/* habits serving this value directly (no goal) */}
              {valueHabits.length > 0 && (
                <div className="mt-5">
                  <Label>// habits</Label>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {valueHabits.map((h) => (
                      <span key={h.id} className="flex items-center gap-2 border border-[var(--color-line)] px-2.5 py-1.5">
                        <Icon name={h.icon} size={13} className="text-ash" />
                        <span className="mono text-[11px] text-ink">{h.name}</span>
                        <span className="mono text-[10px] text-stone">· {habitStreak(tasks, h.id)}d</span>
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          );
        })}
        {!values.length && (
          <Panel ticks className="p-10 text-center">
            <p className="mono text-[12px] text-mist">No values yet. Add one to start building the tree.</p>
          </Panel>
        )}
      </div>

      <ValueDrawer
        value={editValue}
        onClose={() => setEditId(null)}
        onDelete={(v) => { setEditId(null); setConfirmDel(v); }}
      />

      <GoalDrawer goalId={goalEditId} onClose={() => setGoalEditId(null)} />

      <ConfirmDialog
        open={!!confirmDel}
        danger
        title={`Delete "${confirmDel?.name}"?`}
        confirmLabel="Delete"
        body={
          delCounts && (delCounts.goals > 0 || delCounts.habits > 0) ? (
            <>This also removes {delCounts.goals} goal{delCounts.goals === 1 ? "" : "s"} and {delCounts.habits} habit{delCounts.habits === 1 ? "" : "s"} tied to it, plus their scheduled tasks. This can't be undone.</>
          ) : (
            <>This can't be undone.</>
          )
        }
        onConfirm={() => { if (confirmDel) { removeValue(confirmDel.id); pushToast("Value deleted"); } setConfirmDel(null); }}
        onClose={() => setConfirmDel(null)}
      />
    </div>
  );
}

const STATUS_CHIP: Record<string, string> = {
  backlog: "border-[var(--color-line)] text-stone",
  active: "border-ink text-ink",
  paused: "border-[var(--color-line-strong)] text-stone",
  done: "border-good text-good",
  abandoned: "border-[var(--color-line)] text-mist line-through",
};

function GoalCard({ goalId, onEdit }: { goalId: string; onEdit: (id: string) => void }) {
  const goal = useStore((s) => s.goals.find((g) => g.id === goalId))!;
  const habits = useStore((s) => s.habits);
  const updateGoal = useStore((s) => s.updateGoal);
  const removeGoal = useStore((s) => s.removeGoal);
  const pushToast = useStore((s) => s.pushToast);
  const toggleSubgoal = useStore((s) => s.toggleSubgoal);
  const addSubgoal = useStore((s) => s.addSubgoal);
  const removeSubgoal = useStore((s) => s.removeSubgoal);
  const [newSub, setNewSub] = useState("");

  if (!goal) return null;
  const elapsed = goalTimeElapsed(goal);
  const pace = goal.progress - elapsed;
  const linked = habitsForGoal(habits, goal.id);
  const closed = isGoalClosed(goal.status);

  return (
    <div className={cx("border border-[var(--color-line)] p-3.5", closed && "opacity-60")}>
      <div className="flex items-center gap-2">
        <button onClick={() => onEdit(goal.id)} aria-label="Edit goal" className="shrink-0 text-ash hover:text-ink">
          <Icon name={goal.icon} size={15} />
        </button>
        <input
          value={goal.name}
          onChange={(e) => updateGoal(goal.id, { name: e.target.value })}
          className="display flex-1 bg-transparent text-[15px] outline-none"
        />
        <span className={cx("mono shrink-0 border px-1.5 py-0.5 text-[9px] uppercase tracking-[0.12em]", STATUS_CHIP[goal.status])}>
          {GOAL_STATUS_LABEL[goal.status]}
        </span>
        <Menu
          align="end"
          trigger={
            <button aria-label="Goal actions" className="grid h-7 w-7 shrink-0 place-items-center text-stone hover:bg-ink hover:text-paper">
              <Icon name="dots" size={15} />
            </button>
          }
          items={[
            { label: "Edit details", icon: "edit", onSelect: () => onEdit(goal.id) },
            { label: "Delete goal", icon: "trash", danger: true, onSelect: () => { removeGoal(goal.id); pushToast("Goal deleted"); } },
          ]}
        />
      </div>

      <ProgressBar value={goal.progress} knob className="mt-3" />
      <div className="mt-2 flex items-center justify-between">
        <button onClick={() => onEdit(goal.id)} className="mono flex items-center gap-1 text-[10px] text-stone hover:text-ink">
          <Icon name="calendar" size={11} /> {periodLabel(goal.start, goal.end)}
        </button>
        <span className="mono text-[12px] tabular-nums text-stone">{Math.round(goal.progress * 100)}%</span>
        {!closed && (
          <span className={cx("mono text-[10px]", pace >= 0 ? "text-good" : "text-signal")}>
            {pace >= 0 ? "on pace" : `${Math.round(-pace * 100)}% behind`}
          </span>
        )}
      </div>

      {/* subgoals */}
      <div className="mt-3 space-y-1">
        {goal.subgoals.map((s) => (
          <div key={s.id} className="group flex items-center gap-2">
            <button onClick={() => toggleSubgoal(goal.id, s.id)} className={cx("grid h-4 w-4 shrink-0 place-items-center border", s.done ? "border-ink bg-ink text-paper" : "border-[var(--color-line-strong)] text-transparent hover:border-ink")}>
              <Icon name="check" size={10} />
            </button>
            <span className={cx("mono flex-1 text-[11px]", s.done && "text-stone line-through")}>{s.name}</span>
            <button onClick={() => removeSubgoal(goal.id, s.id)} className="text-mist opacity-0 transition-opacity hover:text-signal group-hover:opacity-100">
              <Icon name="close" size={12} />
            </button>
          </div>
        ))}
        <div className="flex items-center gap-2 pt-1">
          <Icon name="plus" size={12} className="text-mist" />
          <input
            value={newSub}
            onChange={(e) => setNewSub(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && newSub.trim()) { addSubgoal(goal.id, newSub.trim()); setNewSub(""); } }}
            placeholder="add a step…"
            className="mono flex-1 bg-transparent text-[11px] outline-none placeholder:text-mist"
          />
        </div>
      </div>

      {linked.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--color-line)] pt-2.5">
          <Label>drives</Label>
          {linked.map((h) => <Tag key={h.id}>{h.name}</Tag>)}
        </div>
      )}
    </div>
  );
}
