import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";
import { GLOBAL_SHORTCUTS, GO_SHORTCUTS } from "./keymap";

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-grid min-w-[20px] place-items-center rounded bg-default-100 px-1.5 py-0.5 font-mono text-tiny text-default-500">
      {children}
    </kbd>
  );
}

function GroupLabel({ children }: { children: React.ReactNode }) {
  return <span className="text-tiny font-medium text-default-500">{children}</span>;
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
            className="w-full max-w-xl overflow-hidden rounded-large border border-divider bg-content1 shadow-medium"
            initial={{ y: 10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 10, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-divider px-4 py-3">
              <h2 className="text-medium font-semibold text-foreground">Keyboard shortcuts</h2>
              <button
                type="button"
                onClick={close}
                aria-label="Close"
                className="text-default-500 transition-colors hover:text-foreground"
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
                      <span className="text-small text-foreground">{s.label}</span>
                      <span className="flex items-center gap-1">
                        <Key>G</Key>
                        <span className="text-default-400">›</span>
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
                      <span className="text-small text-foreground">{s.label}</span>
                      <Key>{s.keys}</Key>
                    </div>
                  ))}
                </div>
                <p className="mt-5 text-tiny leading-relaxed text-default-500">
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
