import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import { cx } from "./cx";
import { Label } from "./primitives";

/** A centered, on-brand confirm modal — replaces window.confirm (browser chrome). */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  body?: React.ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "Enter") onConfirm();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, onConfirm]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[70] grid place-items-center bg-black/35 p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="w-full max-w-sm rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6 shadow-[var(--shadow-soft)]"
            initial={{ scale: 0.96, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ type: "tween", duration: 0.14 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Label>Confirm</Label>
            <h2 className="font-display mt-2 text-xl font-bold leading-tight tracking-[-0.03em]">
              {title}
            </h2>
            {body && (
              <div className="mt-2 font-sans text-[13px] leading-relaxed text-[var(--color-muted)]">
                {body}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2 font-sans text-[13px] font-medium text-[var(--color-ink)] transition-colors duration-150 hover:bg-[var(--color-canvas)] hover:border-[var(--color-accent)]"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={cx(
                  "rounded-[var(--radius-sm)] border px-4 py-2 font-sans text-[13px] font-medium transition-colors duration-150",
                  danger
                    ? "border-[var(--color-signal)] text-[var(--color-signal)] hover:bg-[var(--color-signal)] hover:text-[var(--color-accent-foreground)]"
                    : "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-foreground)] hover:opacity-90",
                )}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
