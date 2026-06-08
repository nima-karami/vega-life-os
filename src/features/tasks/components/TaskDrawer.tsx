import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/core/store";
import { cx, Icon, Label, Tag, Button } from "@/core/ui";
import { alignOf, ALIGN_LABEL } from "@/core/lib/align";
import { fmtLong } from "@/core/lib/date";
import type { Task, TaskStatus } from "../model";

const STATUSES: TaskStatus[] = ["todo", "doing", "done", "skip"];

export function TaskDrawer({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const updateTask = useStore((s) => s.updateTask);
  const removeTask = useStore((s) => s.removeTask);
  const setStatus = useStore((s) => s.setStatus);
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const pushToast = useStore((s) => s.pushToast);

  const value = task ? values.find((v) => v.id === task.valueId) : null;
  const goal = task ? goals.find((g) => g.id === task.goalId) : null;

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
          >
            <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
              <Label ink>// task</Label>
              <button onClick={onClose} aria-label="Close" className="text-stone hover:text-ink">
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              <input
                value={task.title}
                onChange={(e) => updateTask(task.id, { title: e.target.value })}
                className="display w-full bg-transparent text-2xl leading-tight outline-none"
              />

              <div className="flex flex-wrap items-center gap-1.5">
                {task.kind === "habit" && <Tag>HABIT</Tag>}
                {value && <Tag active>{value.name.toUpperCase()}</Tag>}
                <Tag>{ALIGN_LABEL[alignOf(task)].toUpperCase()}</Tag>
                {goal && <Tag>→ {goal.name}</Tag>}
              </div>

              <div className="space-y-2">
                <Label>status</Label>
                <div className="flex gap-1.5">
                  {STATUSES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setStatus(task.id, s)}
                      className={cx(
                        "mono flex-1 border px-2 py-2 text-[10px] uppercase tracking-[0.1em]",
                        task.status === s
                          ? "border-ink bg-ink text-paper"
                          : "border-[var(--color-line)] text-stone hover:border-ink",
                      )}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Labeled label="date">
                  <input
                    type="date"
                    value={task.date ?? ""}
                    onChange={(e) => updateTask(task.id, { date: e.target.value || null })}
                    className="mono w-full bg-transparent text-[12px] outline-none"
                  />
                </Labeled>
                <Labeled label="time">
                  <input
                    type="time"
                    value={task.time ?? ""}
                    onChange={(e) => updateTask(task.id, { time: e.target.value || null })}
                    className="mono w-full bg-transparent text-[12px] outline-none"
                  />
                </Labeled>
              </div>

              {task.date && (
                <p className="mono text-[11px] text-stone">{fmtLong(task.date)}</p>
              )}

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

              <Labeled label="value">
                <select
                  value={task.valueId ?? ""}
                  onChange={(e) => updateTask(task.id, { valueId: e.target.value || null })}
                  className="mono w-full bg-transparent text-[12px] outline-none"
                >
                  <option value="">— none —</option>
                  {values.map((v) => (
                    <option key={v.id} value={v.id}>{v.name}</option>
                  ))}
                </select>
              </Labeled>
            </div>

            <div className="flex items-center justify-between border-t border-[var(--color-line)] px-4 py-3">
              <button
                onClick={() => { removeTask(task.id); pushToast("Task deleted"); onClose(); }}
                className="mono flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] text-stone hover:text-signal"
              >
                <Icon name="trash" size={14} /> Delete
              </button>
              <Button solid onClick={onClose}>Done</Button>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1 border border-[var(--color-line)] px-2.5 py-2">
      <Label>{label}</Label>
      {children}
    </label>
  );
}
