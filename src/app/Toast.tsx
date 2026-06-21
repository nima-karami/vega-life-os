import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/core/store";

export function Toast() {
  const toast = useStore((s) => s.toast);
  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="pointer-events-none fixed bottom-5 left-1/2 z-50 -translate-x-1/2"
        >
          <div className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2.5 font-sans text-[13px] text-[var(--color-ink)] shadow-[var(--shadow-soft)]">
            {toast}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
