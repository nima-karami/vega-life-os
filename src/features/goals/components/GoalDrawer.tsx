import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import type { IconName } from "@/core/lib/icon-names";
import { useStore } from "@/core/store";
import { Button, cx, DatePicker, Icon, Label, Select } from "@/core/ui";
import { GOAL_STATUS_LABEL, GOAL_STATUSES, type GoalStatus } from "../model";
import { detectTimeframe, periodLabel, presetRange, type Timeframe } from "../timeframe";

const GOAL_ICONS: IconName[] = [
  "target",
  "briefcase",
  "book",
  "heart",
  "flash",
  "chart",
  "spark",
  "compass",
  "eye",
  "shield",
  "languages",
  "repeat",
  "globe",
  "sliders",
  "card",
  "flame",
];

const TF_CHIPS: { id: Timeframe; label: string }[] = [
  { id: "quarter", label: "Quarter" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
  { id: "custom", label: "Custom" },
];

export function GoalDrawer({ goalId, onClose }: { goalId: string | null; onClose: () => void }) {
  const goal = useStore((s) => s.goals.find((g) => g.id === goalId)) ?? null;
  const values = useStore((s) => s.values);
  const update = useStore((s) => s.updateGoal);
  const remove = useStore((s) => s.removeGoal);
  const pushToast = useStore((s) => s.pushToast);
  const [forceCustom, setForceCustom] = useState(false);
  const prevGoalId = useRef(goalId);
  if (prevGoalId.current !== goalId) {
    prevGoalId.current = goalId;
    setForceCustom(false);
  }
  useEffect(() => {
    if (!goal) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [goal, onClose]);

  if (!goal) return <AnimatePresence />;

  const detected = detectTimeframe(goal.start, goal.end);
  const activeTf: Timeframe = forceCustom ? "custom" : detected;
  const showDates = activeTf === "custom";
  const hasSteps = goal.subgoals.length > 0;

  const pickTf = (tf: Timeframe) => {
    if (tf === "custom") {
      setForceCustom(true);
      return;
    }
    setForceCustom(false);
    update(goal.id, presetRange(tf));
  };
  const setStatus = (st: GoalStatus) =>
    update(goal.id, { status: st, ...(st === "done" ? { progress: 1 } : {}) });

  return (
    <AnimatePresence>
      {goal && (
        <motion.div
          className="fixed inset-0 z-40 flex justify-end bg-black/25"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.aside
            className="flex h-full w-full max-w-md flex-col border-l border-ink bg-paper"
            initial={{ x: 40 }}
            animate={{ x: 0 }}
            exit={{ x: 40 }}
            transition={{ type: "tween", duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
              <Label ink>// goal</Label>
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
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 shrink-0 place-items-center border border-[var(--color-line-strong)]">
                  <Icon name={goal.icon} size={20} className="text-ink" />
                </span>
                <input
                  value={goal.name}
                  onChange={(e) => update(goal.id, { name: e.target.value })}
                  className="display w-full bg-transparent text-2xl leading-tight outline-none"
                  placeholder="Goal name"
                />
              </div>

              {/* status */}
              <div className="space-y-2">
                <Label>status</Label>
                <div className="flex flex-wrap gap-1.5">
                  {GOAL_STATUSES.map((st) => (
                    <button
                      type="button"
                      key={st}
                      onClick={() => setStatus(st)}
                      className={cx(
                        "mono flex-1 border px-2 py-2 text-[10px] uppercase tracking-[0.08em]",
                        goal.status === st
                          ? "border-ink bg-ink text-paper"
                          : "border-[var(--color-line)] text-stone hover:border-ink",
                      )}
                    >
                      {GOAL_STATUS_LABEL[st]}
                    </button>
                  ))}
                </div>
              </div>

              {/* serves value */}
              <div className="flex flex-col gap-1 border border-[var(--color-line)] px-2.5 py-2">
                <Label>in service of</Label>
                <Select
                  ariaLabel="Value"
                  value={goal.valueId}
                  onValueChange={(v) => update(goal.id, { valueId: v })}
                  options={values.map((v) => ({ value: v.id, label: v.name, hue: v.hue }))}
                />
              </div>

              {/* timeframe */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>timeframe</Label>
                  <span className="mono text-[11px] text-ink">
                    {periodLabel(goal.start, goal.end)}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {TF_CHIPS.map((c) => (
                    <button
                      type="button"
                      key={c.id}
                      onClick={() => pickTf(c.id)}
                      className={cx(
                        "mono flex-1 border px-2 py-1.5 text-[10px] uppercase tracking-[0.08em]",
                        activeTf === c.id
                          ? "border-ink bg-ink text-paper"
                          : "border-[var(--color-line)] text-stone hover:border-ink",
                      )}
                    >
                      {c.label}
                    </button>
                  ))}
                </div>
                {showDates && (
                  <div className="grid grid-cols-2 gap-3 pt-1">
                    <DatePicker
                      label="start"
                      value={goal.start}
                      onChange={(d) => d && update(goal.id, { start: d })}
                    />
                    <DatePicker
                      label="end"
                      value={goal.end}
                      onChange={(d) => d && update(goal.id, { end: d })}
                    />
                  </div>
                )}
              </div>

              {/* progress */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>progress</Label>
                  <span className="mono text-[11px] tabular-nums text-stone">
                    {Math.round(goal.progress * 100)}%
                  </span>
                </div>
                {hasSteps ? (
                  <p className="mono text-[10px] text-mist">
                    Tracked from {goal.subgoals.filter((s) => s.done).length}/{goal.subgoals.length}{" "}
                    steps below.
                  </p>
                ) : (
                  <div className="flex gap-1">
                    {Array.from({ length: 10 }, (_, i) => {
                      const lvl = (i + 1) / 10;
                      const on = goal.progress >= lvl - 0.001;
                      return (
                        <button
                          type="button"
                          key={`progress-${lvl}`}
                          aria-label={`Set progress ${(i + 1) * 10}%`}
                          onClick={() => update(goal.id, { progress: lvl })}
                          className={cx(
                            "h-7 flex-1 border transition-colors",
                            on
                              ? "border-ink bg-ink"
                              : "border-[var(--color-line)] hover:border-ink/50",
                          )}
                        />
                      );
                    })}
                  </div>
                )}
              </div>

              {/* icon */}
              <div className="space-y-2">
                <Label>icon</Label>
                <div className="grid grid-cols-8 gap-1.5">
                  {GOAL_ICONS.map((ic) => (
                    <button
                      type="button"
                      key={ic}
                      onClick={() => update(goal.id, { icon: ic })}
                      className={cx(
                        "grid aspect-square place-items-center border transition-colors",
                        goal.icon === ic
                          ? "border-ink bg-ink text-paper"
                          : "border-[var(--color-line)] text-ash hover:border-ink",
                      )}
                    >
                      <Icon name={ic} size={16} />
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[var(--color-line)] px-4 py-3">
              <button
                type="button"
                onClick={() => {
                  remove(goal.id);
                  pushToast("Goal deleted");
                  onClose();
                }}
                className="mono flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] text-stone hover:text-signal"
              >
                <Icon name="trash" size={14} /> Delete goal
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
