import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";
import { GLOBAL_SHORTCUTS, GO_SHORTCUTS } from "./keymap";

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-grid min-w-[20px] place-items-center rounded bg-[var(--color-canvas)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-muted)]">
      {children}
    </kbd>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-sans text-[11px] font-medium uppercase tracking-wider text-[var(--color-muted)]">
      {children}
    </span>
  );
}

export function Shortcuts() {
  const open = useStore((s) => s.shortcutsOpen);
  const close = () => useStore.getState().setShortcutsOpen(false);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            className="w-full max-w-xl overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
              <h2 className="font-display text-base font-semibold text-[var(--color-ink)]">
                Keyboard shortcuts
              </h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="text-[var(--color-muted)] transition-colors hover:text-[var(--color-ink)]"
              >
                <Icon name="close" size={18} />
              </button>
            </div>
            <div className="grid gap-6 p-5 sm:grid-cols-2">
              <div>
                <GroupLabel>Go to · press G then</GroupLabel>
                <div className="mt-2.5 space-y-1.5">
                  {GO_SHORTCUTS.map((s) => (
                    <div key={s.key} className="flex items-center justify-between">
                      <span className="font-sans text-[13px] text-[var(--color-ink)]">
                        {s.label}
                      </span>
                      <span className="flex items-center gap-1">
                        <Key>G</Key>
                        <span className="text-[var(--color-muted)]">›</span>
                        <Key>{s.key.toUpperCase()}</Key>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <GroupLabel>Global</GroupLabel>
                <div className="mt-2.5 space-y-1.5">
                  {GLOBAL_SHORTCUTS.map((s) => (
                    <div key={s.keys} className="flex items-center justify-between">
                      <span className="font-sans text-[13px] text-[var(--color-ink)]">
                        {s.label}
                      </span>
                      <Key>{s.keys}</Key>
                    </div>
                  ))}
                </div>
                <p className="mt-5 font-sans text-[12px] leading-relaxed text-[var(--color-muted)]">
                  Shortcuts are ignored while typing in a field. Open this anytime with
                  <span className="mx-1">
                    <Key>?</Key>
                  </span>
                  .
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
