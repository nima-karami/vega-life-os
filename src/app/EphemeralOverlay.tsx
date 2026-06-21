import { AnimatePresence, motion } from "framer-motion";
import { useState } from "react";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";
import type { Task } from "@/features/tasks";
import { TaskDrawer, TaskRow } from "@/features/tasks";

/** Renders an agent-conjured view for queries the fixed views don't cover. */
export function EphemeralOverlay() {
  const ephemeral = useStore((s) => s.ephemeral);
  const clear = useStore((s) => s.setEphemeral);
  const tasks = useStore((s) => s.tasks);
  const [selected, setSelected] = useState<Task | null>(null);

  const list = ephemeral?.taskIds
    ? (ephemeral.taskIds.map((id) => tasks.find((t) => t.id === id)).filter(Boolean) as Task[])
    : [];

  return (
    <AnimatePresence>
      {ephemeral && (
        <motion.div
          className="fixed inset-0 z-40 grid place-items-start justify-center bg-black/30 px-4 pt-[10vh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => clear(null)}
        >
          <motion.div
            className="w-full max-w-xl overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]"
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[var(--color-line)] px-4 py-3">
              <div>
                <span className="font-sans text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
                  Generated view
                </span>
                <h2 className="mt-1 font-display text-2xl font-bold leading-tight tracking-tight text-[var(--color-ink)]">
                  {ephemeral.title}
                </h2>
                {ephemeral.subtitle && (
                  <p className="mt-1 font-sans text-[12px] text-[var(--color-muted)]">
                    {ephemeral.subtitle}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => clear(null)}
                aria-label="Close"
                className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="max-h-[58vh] overflow-y-auto p-4">
              {ephemeral.lines && (
                <div className="space-y-1.5">
                  {ephemeral.lines.map((l) => (
                    <p key={l} className="font-sans text-[13px] text-[var(--color-ink)]">
                      {l}
                    </p>
                  ))}
                </div>
              )}
              {ephemeral.taskIds &&
                (list.length ? (
                  <div className="divide-y divide-[var(--color-line)]">
                    {list.map((t) => (
                      <TaskRow key={t.id} task={t} onOpen={setSelected} showDate />
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center font-sans text-[13px] text-[var(--color-muted)]">
                    Nothing here. Clear skies.
                  </p>
                ))}
            </div>
          </motion.div>
          <TaskDrawer task={selected} onClose={() => setSelected(null)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
