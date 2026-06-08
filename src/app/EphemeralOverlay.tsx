import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/core/store";
import { Label, Icon } from "@/core/ui";
import { TaskRow, TaskDrawer } from "@/features/tasks";
import type { Task } from "@/features/tasks";

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
          className="fixed inset-0 z-40 grid place-items-start justify-center bg-black/30 px-4 pt-[10vh]"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={() => clear(null)}
        >
          <motion.div
            className="w-full max-w-xl border border-ink bg-paper shadow-2xl"
            initial={{ y: -10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -10, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between border-b border-[var(--color-line)] px-4 py-3">
              <div>
                <Label>// generated view</Label>
                <h2 className="display mt-1 text-2xl leading-none">{ephemeral.title}</h2>
                {ephemeral.subtitle && <p className="mono mt-1 text-[11px] text-stone">{ephemeral.subtitle}</p>}
              </div>
              <button onClick={() => clear(null)} aria-label="Close" className="text-stone hover:text-ink">
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="max-h-[58vh] overflow-y-auto p-4">
              {ephemeral.lines && (
                <div className="space-y-1.5">
                  {ephemeral.lines.map((l, i) => (
                    <p key={i} className="mono text-[12px] text-ink">{l}</p>
                  ))}
                </div>
              )}
              {ephemeral.taskIds && (
                list.length ? (
                  <div className="divide-y divide-[var(--color-line)]">
                    {list.map((t) => <TaskRow key={t.id} task={t} onOpen={setSelected} showDate />)}
                  </div>
                ) : (
                  <p className="mono py-8 text-center text-[12px] text-mist">Nothing here. Clear skies.</p>
                )
              )}
            </div>
          </motion.div>
          <TaskDrawer task={selected} onClose={() => setSelected(null)} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
