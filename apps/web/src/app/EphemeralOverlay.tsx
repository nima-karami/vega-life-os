import { ScrollShadow } from "@heroui/react";
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
          className="safe-inset-x fixed inset-0 z-40 grid place-items-start justify-center bg-black/40 px-4 pt-[10dvh] backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => clear(null)}
        >
          <motion.div
            className="w-full max-w-xl overflow-hidden rounded-[16px] border border-border bg-surface shadow-md"
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -10, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-border px-4 py-3">
              <div>
                <span className="text-xs font-medium text-muted">Generated view</span>
                <h2 className="mt-1 text-2xl font-semibold leading-tight tracking-tight text-foreground">
                  {ephemeral.title}
                </h2>
                {ephemeral.subtitle && (
                  <p className="mt-1 text-xs text-muted">{ephemeral.subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => clear(null)}
                aria-label="Close"
                className="text-muted transition-colors hover:text-foreground"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <ScrollShadow className="max-h-[58dvh] p-4">
              {ephemeral.lines && (
                <div className="space-y-1.5">
                  {ephemeral.lines.map((l) => (
                    <p key={l} className="text-sm text-foreground">
                      {l}
                    </p>
                  ))}
                </div>
              )}
              {ephemeral.taskIds &&
                (list.length ? (
                  <div className="divide-y divide-divider">
                    {list.map((t) => (
                      <TaskRow key={t.id} task={t} onOpen={setSelected} showDate />
                    ))}
                  </div>
                ) : (
                  <p className="py-8 text-center text-sm text-muted">Nothing here. Clear skies.</p>
                ))}
            </ScrollShadow>
          </motion.div>
          <TaskDrawer task={selected} onClose={() => setSelected(null)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
