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
          <div className="rounded-medium border border-divider bg-content1 px-4 py-2.5 text-small text-foreground shadow-medium">
            {toast}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
