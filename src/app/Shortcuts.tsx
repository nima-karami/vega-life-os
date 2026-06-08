import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/core/store";
import { Label, Icon } from "@/core/ui";
import { GO_SHORTCUTS, GLOBAL_SHORTCUTS } from "./keymap";

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="mono inline-grid min-w-[20px] place-items-center border border-[var(--color-line-strong)] px-1.5 py-0.5 text-[10px] text-ink">
      {children}
    </kbd>
  );
}

export function Shortcuts() {
  const open = useStore((s) => s.shortcutsOpen);
  const close = () => useStore.getState().setShortcutsOpen(false);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 grid place-items-center bg-black/30 px-4"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          onClick={close}
        >
          <motion.div
            className="w-full max-w-xl border border-ink bg-paper shadow-2xl"
            initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 10, opacity: 0 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
              <Label ink>// keyboard</Label>
              <button onClick={close} aria-label="Close" className="text-stone hover:text-ink"><Icon name="close" size={18} /></button>
            </div>
            <div className="grid gap-6 p-5 sm:grid-cols-2">
              <div>
                <Label>go to · press G then</Label>
                <div className="mt-2.5 space-y-1.5">
                  {GO_SHORTCUTS.map((s) => (
                    <div key={s.key} className="flex items-center justify-between">
                      <span className="mono text-[12px] text-ink">{s.label}</span>
                      <span className="flex items-center gap-1">
                        <Key>G</Key><span className="text-mist">›</span><Key>{s.key.toUpperCase()}</Key>
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <Label>global</Label>
                <div className="mt-2.5 space-y-1.5">
                  {GLOBAL_SHORTCUTS.map((s) => (
                    <div key={s.keys} className="flex items-center justify-between">
                      <span className="mono text-[12px] text-ink">{s.label}</span>
                      <Key>{s.keys}</Key>
                    </div>
                  ))}
                </div>
                <p className="mono mt-5 text-[10px] leading-relaxed text-mist">
                  Shortcuts are ignored while typing in a field. Open this anytime with
                  <span className="mx-1"><Key>?</Key></span>.
                </p>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
