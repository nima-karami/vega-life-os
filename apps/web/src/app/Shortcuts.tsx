import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";
import { GLOBAL_SHORTCUTS, GO_SHORTCUTS } from "./keymap";

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-grid min-w-[20px] place-items-center rounded bg-surface-secondary px-1.5 py-0.5 font-mono text-xs text-muted">
      {children}
    </kbd>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-xs font-medium text-muted">{children}</span>;
}

export function Shortcuts() {
  const open = useStore((s) => s.shortcutsOpen);
  const close = () => useStore.getState().setShortcutsOpen(false);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/40 px-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            className="w-full max-w-xl overflow-hidden rounded-[16px] border border-border bg-surface shadow-md"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-base font-semibold text-foreground">Keyboard shortcuts</h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="text-muted transition-colors hover:text-foreground"
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
                      <span className="text-sm text-foreground">{s.label}</span>
                      <span className="flex items-center gap-1">
                        <Key>G</Key>
                        <span className="text-muted">›</span>
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
                      <span className="text-sm text-foreground">{s.label}</span>
                      <Key>{s.keys}</Key>
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-xs leading-relaxed text-muted">
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
