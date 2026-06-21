import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { fmtLong } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { cx, DatePicker, Icon, NONE, Select, TimeRange } from "@/core/ui";
import { ENERGY_META, STATUS_LABEL, type Task, type TaskEnergy, type TaskStatus } from "../model";
import { energyOf } from "../selectors";

const STATUSES: TaskStatus[] = ["open", "todo", "done", "skip"];
const ENERGIES: TaskEnergy[] = ["charge", "neutral", "drain"];

/**
 * Task editor — re-skinned to vapor. Opens as a right-hand sheet. All edits are
 * live (write straight through the store). Reuses the existing data wiring:
 * title, status, energy, date/time, value/goal links, note, delete.
 */
export function TaskDrawer({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const updateTask = useStore((s) => s.updateTask);
  const removeTask = useStore((s) => s.removeTask);
  const setStatus = useStore((s) => s.setStatus);
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const pushToast = useStore((s) => s.pushToast);

  // Goals scoped to the task's value (when set) — keeps the link coherent.
  const goalOptions = task?.valueId ? goals.filter((g) => g.valueId === task.valueId) : goals;

  useEffect(() => {
    if (!task) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [task, onClose]);

  return (
    <AnimatePresence>
      {task && (
        <motion.div
          className="fixed inset-0 z-40 flex justify-end bg-black/30 backdrop-blur-[1px]"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.aside
            role="dialog"
            aria-label="Edit task"
            className="flex h-full w-full max-w-md flex-col bg-[var(--color-surface)] shadow-[var(--shadow-soft)]"
            initial={{ x: 40, opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: "tween", duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
            }}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-line)] px-5 py-4">
              <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
                Edit task
              </span>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="grid h-8 w-8 place-items-center rounded-[var(--radius-sm)] text-[var(--color-muted)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="flex-1 space-y-6 overflow-y-auto p-5">
              <input
                value={task.title}
                onChange={(e) => updateTask(task.id, { title: e.target.value })}
                aria-label="Task title"
                className="w-full bg-transparent font-display text-2xl font-semibold leading-tight text-[var(--color-ink)] outline-none"
              />

              <Section label="Status">
                <div className="grid grid-cols-4 gap-1.5">
                  {STATUSES.map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setStatus(task.id, s)}
                      className={cx(
                        "rounded-[var(--radius-sm)] border px-2 py-2 font-sans text-xs font-medium transition-colors",
                        task.status === s
                          ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
                          : "border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-accent)]",
                      )}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </Section>

              <Section label="Energy">
                <div className="grid grid-cols-3 gap-1.5">
                  {ENERGIES.map((e) => (
                    <button
                      type="button"
                      key={e}
                      onClick={() => updateTask(task.id, { energy: e })}
                      className={cx(
                        "rounded-[var(--radius-sm)] border px-2 py-2 font-sans text-xs font-medium transition-colors",
                        energyOf(task) === e
                          ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
                          : "border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-accent)]",
                      )}
                    >
                      {ENERGY_META[e].glyph} {ENERGY_META[e].label}
                    </button>
                  ))}
                </div>
              </Section>

              <div className="grid grid-cols-2 gap-3">
                <SelectField label="Value">
                  <Select
                    ariaLabel="Value"
                    value={task.valueId ?? NONE}
                    onValueChange={(v) =>
                      updateTask(task.id, {
                        valueId: v === NONE ? null : v,
                        goalId:
                          v !== NONE &&
                          task.goalId &&
                          goals.find((g) => g.id === task.goalId)?.valueId !== v
                            ? null
                            : task.goalId,
                      })
                    }
                    options={[
                      { value: NONE, label: "— none —" },
                      ...values.map((v) => ({ value: v.id, label: v.name })),
                    ]}
                  />
                </SelectField>
                <SelectField label="Goal">
                  <Select
                    ariaLabel="Goal"
                    value={task.goalId ?? NONE}
                    onValueChange={(v) => updateTask(task.id, { goalId: v === NONE ? null : v })}
                    options={[
                      { value: NONE, label: "— none —" },
                      ...goalOptions.map((g) => ({ value: g.id, label: g.name })),
                    ]}
                  />
                </SelectField>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <DatePicker
                  label="date"
                  value={task.date}
                  onChange={(date) => updateTask(task.id, { date })}
                />
                <TimeRange
                  label="time block"
                  value={{ time: task.time, durationMin: task.durationMin }}
                  onChange={({ time, durationMin }) => updateTask(task.id, { time, durationMin })}
                />
              </div>

              {task.date && (
                <p className="font-mono text-xs text-[var(--color-muted)]">
                  {fmtLong(task.date)}
                  {task.time ? ` · ${task.time}` : ""}
                </p>
              )}

              <Section label="Note">
                <textarea
                  value={task.note}
                  onChange={(e) => updateTask(task.id, { note: e.target.value })}
                  rows={4}
                  placeholder="Context, links, why it moved…"
                  className="w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-transparent p-3 font-sans text-sm leading-relaxed text-[var(--color-ink)] outline-none focus:border-[var(--color-accent)] placeholder:text-[var(--color-muted)]"
                />
              </Section>
            </div>

            <div className="flex items-center justify-between border-t border-[var(--color-line)] px-5 py-4">
              <button
                type="button"
                onClick={() => {
                  removeTask(task.id);
                  pushToast("Task deleted");
                  onClose();
                }}
                className="flex items-center gap-1.5 font-sans text-sm text-[var(--color-muted)] transition-colors hover:text-[var(--color-accent)]"
              >
                <Icon name="trash" size={15} /> Delete
              </button>
              <button
                type="button"
                onClick={onClose}
                className="rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-4 py-2 font-sans text-sm font-medium text-[var(--color-accent-foreground)] transition-opacity hover:opacity-90"
              >
                Done
              </button>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <span className="font-sans text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
        {label}
      </span>
      {children}
    </div>
  );
}

function SelectField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] px-3 py-2">
      {label && (
        <span className="font-sans text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
          {label}
        </span>
      )}
      {children}
    </div>
  );
}
