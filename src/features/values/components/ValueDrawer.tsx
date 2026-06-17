import { AnimatePresence, motion } from "framer-motion";
import { useEffect } from "react";
import type { IconName } from "@/core/lib/icon-names";
import { useStore } from "@/core/store";
import { Button, cx, Icon, Label } from "@/core/ui";
import type { Value } from "../model";

const VALUE_ICONS: IconName[] = [
  "compass",
  "heart",
  "shield",
  "eye",
  "target",
  "briefcase",
  "book",
  "spark",
  "flame",
  "sun",
  "moon",
  "orbit",
  "languages",
  "repeat",
  "chart",
  "globe",
];

const HUES = [
  "#55554c",
  "#18180f",
  "#7a5cd8",
  "#2bb6a8",
  "#d8744f",
  "#c2a14e",
  "#5f7d3a",
  "#3f63d8",
  "#b154c9",
  "#c9501e",
];

export function ValueDrawer({
  value,
  onClose,
  onDelete,
}: {
  value: Value | null;
  onClose: () => void;
  onDelete: (v: Value) => void;
}) {
  const update = useStore((s) => s.updateValue);

  useEffect(() => {
    if (!value) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [value, onClose]);

  return (
    <AnimatePresence>
      {value && (
        <motion.div
          className="fixed inset-0 z-40 flex justify-end bg-black/25"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.aside
            className="flex h-full w-full max-w-md flex-col border-l border-ink bg-paper"
            initial={{ x: 40 }}
            animate={{ x: 0 }}
            exit={{ x: 40 }}
            transition={{ type: "tween", duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
              <Label ink>// value</Label>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="text-stone hover:text-ink"
              >
                <Icon name="close" size={18} />
              </button>
            </div>

            <div className="flex-1 space-y-5 overflow-y-auto p-4">
              <div className="flex items-center gap-3">
                <span
                  className="grid h-12 w-12 shrink-0 place-items-center rounded-full border border-[var(--color-line-strong)]"
                  style={{ background: value.hue }}
                >
                  <Icon name={value.icon} size={22} className="text-paper" />
                </span>
                <input
                  value={value.name}
                  onChange={(e) => update(value.id, { name: e.target.value })}
                  className="display w-full bg-transparent text-2xl leading-tight outline-none"
                  placeholder="Value name"
                />
              </div>

              <div className="space-y-1.5">
                <Label>what it means to you</Label>
                <textarea
                  value={value.desc}
                  onChange={(e) => update(value.id, { desc: e.target.value })}
                  rows={3}
                  placeholder="A sentence on why this matters…"
                  className="mono w-full resize-none border border-[var(--color-line)] bg-transparent p-2.5 text-[12px] leading-relaxed outline-none focus:border-ink placeholder:text-mist"
                />
              </div>

              {/* energy */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>energy this week</Label>
                  <span className="mono text-[11px] tabular-nums text-stone">
                    {Math.round(value.energy * 100)}%
                  </span>
                </div>
                <div className="flex gap-1">
                  {Array.from({ length: 10 }, (_, i) => {
                    const lvl = (i + 1) / 10;
                    const on = value.energy >= lvl - 0.001;
                    return (
                      <button
                        type="button"
                        key={`energy-${lvl}`}
                        aria-label={`Set energy ${(i + 1) * 10}%`}
                        onClick={() => update(value.id, { energy: lvl })}
                        className={cx(
                          "h-7 flex-1 border transition-colors",
                          on
                            ? "border-ink bg-ink"
                            : "border-[var(--color-line)] hover:border-ink/50",
                        )}
                      />
                    );
                  })}
                </div>
              </div>

              {/* icon */}
              <div className="space-y-2">
                <Label>icon</Label>
                <div className="grid grid-cols-8 gap-1.5">
                  {VALUE_ICONS.map((ic) => (
                    <button
                      type="button"
                      key={ic}
                      onClick={() => update(value.id, { icon: ic })}
                      className={cx(
                        "grid aspect-square place-items-center border transition-colors",
                        value.icon === ic
                          ? "border-ink bg-ink text-paper"
                          : "border-[var(--color-line)] text-ash hover:border-ink",
                      )}
                    >
                      <Icon name={ic} size={16} />
                    </button>
                  ))}
                </div>
              </div>

              {/* hue */}
              <div className="space-y-2">
                <Label>marker hue</Label>
                <div className="flex flex-wrap gap-2">
                  {HUES.map((h) => (
                    <button
                      type="button"
                      key={h}
                      onClick={() => update(value.id, { hue: h })}
                      aria-label={`Hue ${h}`}
                      className={cx(
                        "h-8 w-8 rounded-full border-2 transition-transform hover:scale-110",
                        value.hue === h ? "border-ink" : "border-[var(--color-line)]",
                      )}
                      style={{ background: h }}
                    />
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[var(--color-line)] px-4 py-3">
              <button
                type="button"
                onClick={() => onDelete(value)}
                className="mono flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] text-stone hover:text-signal"
              >
                <Icon name="trash" size={14} /> Delete value
              </button>
              <Button solid onClick={onClose}>
                Done
              </Button>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
