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
            className="w-full max-w-sm border border-ink bg-paper p-5 shadow-[0_12px_40px_rgba(24,24,15,0.3)]"
            initial={{ scale: 0.96, opacity: 0.6 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.97, opacity: 0 }}
            transition={{ type: "tween", duration: 0.14 }}
            onClick={(e) => e.stopPropagation()}
          >
            <Label ink>// confirm</Label>
            <h2 className="display mt-2 text-xl leading-tight">{title}</h2>
            {body && <div className="mono mt-2 text-[12px] leading-relaxed text-stone">{body}</div>}
            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={onClose} className="btn">
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                className={cx(
                  "btn",
                  danger
                    ? "border-signal text-signal hover:bg-signal hover:text-paper"
                    : "btn-solid",
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
