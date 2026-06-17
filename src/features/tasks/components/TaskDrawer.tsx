import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { fmtLong } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { Button, cx, DatePicker, Icon, Label, NONE, Select, Tag, TimeRange } from "@/core/ui";
import { ENERGY_META, STATUS_LABEL, type Task, type TaskEnergy, type TaskStatus } from "../model";
import { energyOf } from "../selectors";

const STATUSES: TaskStatus[] = ["open", "todo", "done", "skip"];
const ENERGIES: TaskEnergy[] = ["charge", "neutral", "drain"];

export function TaskDrawer({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const updateTask = useStore((s) => s.updateTask);
  const removeTask = useStore((s) => s.removeTask);
  const setStatus = useStore((s) => s.setStatus);
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const pushToast = useStore((s) => s.pushToast);

  const value = task ? values.find((v) => v.id === task.valueId) : null;
  const goal = task ? goals.find((g) => g.id === task.goalId) : null;

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
          className="fixed inset-0 z-40 flex justify-end bg-black/25"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.aside
            className="flex h-full w-full max-w-md flex-col border-l border-ink bg-paper"
            initial={{ x: 40, opacity: 0.6 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: 40, opacity: 0 }}
            transition={{ type: "tween", duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") onClose();
            }}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
              <Label ink>// task</Label>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="text-stone hover:text-ink"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              <input
                value={task.title}
                onChange={(e) => updateTask(task.id, { title: e.target.value })}
                className="display w-full bg-transparent text-2xl leading-tight outline-none"
              />

              {/* hierarchy: value → goal → habit (errand only when unaligned) */}
              <div className="flex flex-wrap items-center gap-1.5">
                {value && <Tag active>{value.name.toUpperCase()}</Tag>}
                {goal && <Tag>→ {goal.name}</Tag>}
                {task.kind === "habit" && <Tag>HABIT</Tag>}
                {!task.valueId && !task.goalId && <Tag>ERRAND</Tag>}
              </div>

              <div className="space-y-2">
                <Label>status</Label>
                <div className="flex gap-1.5">
                  {STATUSES.map((s) => (
                    <button
                      type="button"
                      key={s}
                      onClick={() => setStatus(task.id, s)}
                      className={cx(
                        "mono flex-1 border px-2 py-2 text-[10px] uppercase tracking-[0.1em]",
                        task.status === s
                          ? "border-ink bg-ink text-paper"
                          : "border-[var(--color-line)] text-stone hover:border-ink",
                      )}
                    >
                      {STATUS_LABEL[s]}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>energy</Label>
                <div className="flex gap-1.5">
                  {ENERGIES.map((e) => (
                    <button
                      type="button"
                      key={e}
                      onClick={() => updateTask(task.id, { energy: e })}
                      className={cx(
                        "mono flex-1 border px-2 py-2 text-[10px] uppercase tracking-[0.08em]",
                        energyOf(task) === e
                          ? "border-ink bg-ink text-paper"
                          : "border-[var(--color-line)] text-stone hover:border-ink",
                      )}
                    >
                      {ENERGY_META[e].glyph} {ENERGY_META[e].label}
                    </button>
                  ))}
                </div>
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
                {task.date && (
                  <div className="col-span-2 flex items-center gap-1.5 px-1">
                    <Label>when</Label>
                    <span className="mono text-[11px] leading-snug text-stone">
                      {fmtLong(task.date)}
                      {task.time ? ` · ${task.time}` : ""}
                    </span>
                  </div>
                )}
              </div>

              <div className="space-y-2">
                <Label>note</Label>
                <textarea
                  value={task.note}
                  onChange={(e) => updateTask(task.id, { note: e.target.value })}
                  rows={4}
                  placeholder="Context, links, why it moved…"
                  className="mono w-full resize-none border border-[var(--color-line)] bg-transparent p-2.5 text-[12px] leading-relaxed outline-none focus:border-ink placeholder:text-mist"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Labeled label="value">
                  <Select
                    ariaLabel="Value"
                    value={task.valueId ?? NONE}
                    onValueChange={(v) => updateTask(task.id, { valueId: v === NONE ? null : v })}
                    options={[
                      { value: NONE, label: "— none —" },
                      ...values.map((v) => ({ value: v.id, label: v.name, hue: v.hue })),
                    ]}
                  />
                </Labeled>
                <Labeled label="goal">
                  <Select
                    ariaLabel="Goal"
                    value={task.goalId ?? NONE}
                    onValueChange={(v) => updateTask(task.id, { goalId: v === NONE ? null : v })}
                    options={[
                      { value: NONE, label: "— none —" },
                      ...goals.map((g) => ({ value: g.id, label: g.name })),
                    ]}
                  />
                </Labeled>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[var(--color-line)] px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  removeTask(task.id);
                  pushToast("Task deleted");
                  onClose();
                }}
                className="mono flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] text-stone hover:text-signal"
              >
                <Icon name="trash" size={14} /> Delete
              </button>
              <Button solid onClick={onClose}>
                Done
              </Button>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1 border border-[var(--color-line)] px-2.5 py-2">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
