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
          <div className="mono border border-ink bg-ink px-4 py-2.5 text-[11px] uppercase tracking-[0.12em] text-paper shadow-lg">
            {toast}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
