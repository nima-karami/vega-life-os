import { useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/core/store";
import { cx, Icon, Label, Button, Stars, Select, NONE } from "@/core/ui";
import { todayISO } from "@/core/lib/date";
import type { Book, BookStatus } from "../model";

const STATUSES: BookStatus[] = ["queued", "reading", "finished", "abandoned"];

export function BookDrawer({ book, onClose }: { book: Book | null; onClose: () => void }) {
  const update = useStore((s) => s.updateBook);
  const remove = useStore((s) => s.removeBook);
  const values = useStore((s) => s.values);
  const pushToast = useStore((s) => s.pushToast);

  useEffect(() => {
    if (!book) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [book, onClose]);

  return (
    <AnimatePresence>
      {book && (
        <motion.div className="fixed inset-0 z-40 flex justify-end bg-black/25"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose}>
          <motion.aside className="flex h-full w-full max-w-md flex-col border-l border-ink bg-paper"
            initial={{ x: 40 }} animate={{ x: 0 }} exit={{ x: 40 }} transition={{ type: "tween", duration: 0.18 }}
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => { if (e.key === "Escape") onClose(); }}>
            <div className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
              <Label ink>// book</Label>
              <button onClick={onClose} aria-label="Close" className="text-stone hover:text-ink"><Icon name="close" size={18} /></button>
            </div>

            <div className="flex-1 space-y-4 overflow-y-auto p-4">
              <input value={book.title} onChange={(e) => update(book.id, { title: e.target.value })}
                className="display w-full bg-transparent text-2xl leading-tight outline-none" placeholder="Title" />
              <input value={book.author} onChange={(e) => update(book.id, { author: e.target.value })}
                className="mono w-full bg-transparent text-[13px] text-stone outline-none" placeholder="Author" />

              <div className="space-y-2">
                <Label>status</Label>
                <div className="grid grid-cols-4 gap-1.5">
                  {STATUSES.map((s) => (
                    <button key={s} onClick={() => update(book.id, { status: s, finishedAt: s === "finished" ? todayISO() : book.finishedAt })}
                      className={cx("mono border px-1 py-2 text-[9px] uppercase tracking-[0.06em]",
                        book.status === s ? "border-ink bg-ink text-paper" : "border-[var(--color-line)] text-stone hover:border-ink")}>
                      {s}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between border border-[var(--color-line)] px-3 py-2.5">
                <Label>rating</Label>
                <Stars value={book.rating} size={18} onChange={(r) => update(book.id, { rating: r })} />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Num label="current page" value={book.currentPage} onChange={(v) => update(book.id, { currentPage: v })} />
                <Num label="total pages" value={book.pages} onChange={(v) => update(book.id, { pages: v })} />
              </div>

              <label className="flex flex-col gap-1 border border-[var(--color-line)] px-2.5 py-2">
                <Label>serves value</Label>
                <Select
                  ariaLabel="Serves value"
                  value={book.valueId ?? NONE}
                  onValueChange={(v) => update(book.id, { valueId: v === NONE ? null : v })}
                  options={[
                    { value: NONE, label: "— none —" },
                    ...values.map((v) => ({ value: v.id, label: v.name, hue: v.hue })),
                  ]}
                />
              </label>

              <div className="space-y-1.5">
                <Label>note</Label>
                <textarea value={book.note} onChange={(e) => update(book.id, { note: e.target.value })} rows={4}
                  placeholder="Quotes, takeaways…"
                  className="mono w-full resize-none border border-[var(--color-line)] bg-transparent p-2.5 text-[12px] leading-relaxed outline-none focus:border-ink placeholder:text-mist" />
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[var(--color-line)] px-4 py-3">
              <button onClick={() => { remove(book.id); pushToast("Book removed"); onClose(); }}
                className="mono flex items-center gap-1.5 text-[11px] uppercase tracking-[0.1em] text-stone hover:text-signal">
                <Icon name="trash" size={14} /> Remove
              </button>
              <Button solid onClick={onClose}>Done</Button>
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Num({ label, value, onChange }: { label: string; value: number | null; onChange: (v: number | null) => void }) {
  return (
    <label className="flex flex-col gap-1 border border-[var(--color-line)] px-2.5 py-2">
      <Label>{label}</Label>
      <input type="number" value={value ?? ""} onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
        className="mono bg-transparent text-[13px] outline-none" />
    </label>
  );
}
