import { useEffect, useRef, useState } from "react";
import { useStore } from "@/core/store";
import { cx, Icon, NONE, Select } from "@/core/ui";
import { buildTaskPatch, type CaptureDraft, goalsForValue } from "@/features/today/today-logic";

const EMPTY: CaptureDraft = { title: "", valueId: null, goalId: null, habitId: null };

/**
 * Inline "Add a task" capture for the Today view.
 *
 * Collapsed: a subtle "Add a task" affordance. Expanded: a title input
 * (autofocus), plus value / goal / habit pickers that capture *what the task
 * is for*. Goal options are scoped to the chosen value; picking a habit
 * inherits its value + goal. Commits via `addTask` dated today, then resets.
 */
export function AddTaskInline({
  date,
  onAdded,
}: {
  date: string;
  onAdded?: (title: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CaptureDraft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const addTask = useStore((s) => s.addTask);
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const habits = useStore((s) => s.habits);

  useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [open]);

  const valueGoals = goalsForValue(goals, draft.valueId);
  const canCommit = draft.title.trim().length > 0 && !busy;

  function reset() {
    setDraft(EMPTY);
    setBusy(false);
  }

  function close() {
    reset();
    setOpen(false);
  }

  function commit() {
    if (!canCommit) return;
    setBusy(true); // guard against double-submit
    const title = draft.title.trim();
    addTask(buildTaskPatch(draft, date));
    onAdded?.(title);
    reset();
    titleRef.current?.focus();
  }

  // Picking a habit inherits its value + goal and locks kind to habit.
  function chooseHabit(habitId: string | null) {
    if (habitId == null) {
      setDraft((d) => ({ ...d, habitId: null }));
      return;
    }
    const h = habits.find((x) => x.id === habitId);
    setDraft((d) => ({
      ...d,
      habitId,
      valueId: h?.valueId ?? d.valueId,
      goalId: h?.goalId ?? d.goalId,
    }));
  }

  // Changing the value clears an incompatible goal.
  function chooseValue(valueId: string | null) {
    setDraft((d) => {
      const goalStillValid =
        d.goalId != null && goalsForValue(goals, valueId).some((g) => g.id === d.goalId);
      return { ...d, valueId, goalId: goalStillValid ? d.goalId : null };
    });
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="flex w-full items-center gap-2 rounded-[var(--radius-md)] border border-dashed border-[var(--color-line-strong)] bg-transparent px-4 py-3 text-left font-sans text-sm text-[var(--color-muted)] transition-colors hover:border-[var(--color-accent)] hover:text-[var(--color-ink)]"
      >
        <Icon name="plus" size={16} />
        Add a task
      </button>
    );
  }

  return (
    <form
      aria-label="Add a task"
      className="rounded-[var(--radius-md)] border border-[var(--color-accent)]/50 bg-[var(--color-surface)] p-3 shadow-[var(--shadow-soft)]"
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape") {
          e.stopPropagation();
          close();
        }
      }}
    >
      <input
        ref={titleRef}
        value={draft.title}
        onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
        maxLength={200}
        placeholder="What needs doing today?"
        aria-label="Task title"
        className="w-full bg-transparent font-sans text-[15px] text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)]"
      />

      {!draft.title.trim() && (
        <p className="mt-1 font-sans text-xs text-[var(--color-muted)]">Give it a name</p>
      )}

      <div className="mt-3 grid grid-cols-3 gap-2">
        <Picker label="Value">
          <Select
            ariaLabel="Value"
            value={draft.valueId ?? NONE}
            onValueChange={(v) => chooseValue(v === NONE ? null : v)}
            placeholder="None"
            options={[
              { value: NONE, label: "None" },
              ...values.map((v) => ({ value: v.id, label: v.name })),
            ]}
          />
        </Picker>
        <Picker label="Goal">
          <Select
            ariaLabel="Goal"
            value={draft.goalId ?? NONE}
            onValueChange={(v) => setDraft((d) => ({ ...d, goalId: v === NONE ? null : v }))}
            placeholder="None"
            options={[
              { value: NONE, label: "None" },
              ...valueGoals.map((g) => ({ value: g.id, label: g.name })),
            ]}
          />
        </Picker>
        <Picker label="Habit">
          <Select
            ariaLabel="Habit"
            value={draft.habitId ?? NONE}
            onValueChange={(v) => chooseHabit(v === NONE ? null : v)}
            placeholder="None"
            options={[
              { value: NONE, label: "None" },
              ...habits.map((h) => ({ value: h.id, label: h.name })),
            ]}
          />
        </Picker>
      </div>

      <div className="mt-3 flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={close}
          className="rounded-[var(--radius-sm)] px-3 py-1.5 font-sans text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={!canCommit}
          aria-disabled={!canCommit}
          className={cx(
            "rounded-[var(--radius-sm)] px-4 py-1.5 font-sans text-sm font-medium transition-colors",
            canCommit
              ? "bg-[var(--color-accent)] text-[var(--color-accent-foreground)] hover:opacity-90"
              : "cursor-not-allowed bg-[var(--color-line)] text-[var(--color-muted)]",
          )}
        >
          Add task
        </button>
      </div>
    </form>
  );
}

function Picker({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] px-2.5 py-1.5">
      <span className="font-sans text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
        {label}
      </span>
      {children}
    </div>
  );
}
