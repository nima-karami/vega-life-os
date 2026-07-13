import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { useEffect } from "react";
import { useStore } from "@/core/store";

export function Toast() {
  const toast = useStore((s) => s.toast);
  const dismissToast = useStore((s) => s.dismissToast);

  useEffect(() => {
    if (!toast?.sticky && !toast?.action) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") dismissToast();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [toast, dismissToast]);

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.2 }}
          className={`safe-mb fixed bottom-5 left-1/2 z-50 -translate-x-1/2 ${
            toast.action ? "pointer-events-auto" : "pointer-events-none"
          }`}
        >
          <div
            role="status"
            aria-live="polite"
            className="flex items-center gap-3 rounded-[12px] border border-border bg-surface px-4 py-2.5 text-sm text-foreground shadow-md"
          >
            <span>{toast.message}</span>
            {toast.action && (
              <button
                type="button"
                onClick={toast.action.onClick}
                className="font-medium text-accent underline-offset-2 hover:underline focus-visible:outline-2"
              >
                {toast.action.label}
              </button>
            )}
            {toast.sticky && (
              <button
                type="button"
                aria-label="Dismiss"
                onClick={dismissToast}
                className="text-muted hover:text-foreground"
              >
                <X className="size-4" />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
