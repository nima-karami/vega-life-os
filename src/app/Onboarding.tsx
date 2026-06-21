import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";

const STEPS = [
  { v: "Value", d: "What you stand for — your gravitational centers." },
  { v: "Goal", d: "A finish line that serves a value." },
  { v: "Habit", d: "The repeated act that moves a goal, or just keeps a value alive." },
  { v: "Task", d: "The atom you actually check off today." },
];

/**
 * First-run onboarding — re-skinned to vapor. Behavior is unchanged: capture an
 * optional operator name, then either seed demo data or start empty.
 */
export function Onboarding() {
  const setOnboarded = useStore((s) => s.setOnboarded);
  const setOperatorName = useStore((s) => s.setOperatorName);
  const wipe = useStore((s) => s.wipe);
  const operatorName = useStore((s) => s.operatorName);
  const [name, setName] = useState(operatorName === "Operator" ? "" : operatorName);
  const [busy, setBusy] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const finish = async (mode: "demo" | "empty") => {
    setBusy(true);
    if (name.trim()) setOperatorName(name.trim());
    if (mode === "empty") await wipe();
    setOnboarded(true);
  };

  return (
    <div className="grid h-screen place-items-center bg-[var(--color-canvas)] px-4 text-[var(--color-ink)]">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg"
      >
        <div className="mb-8 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-[var(--radius-sm)] bg-[var(--color-accent)] text-[var(--color-accent-foreground)]">
            <span className="font-display text-xl font-bold leading-none">V</span>
          </span>
          <div className="flex items-baseline gap-2">
            <span className="font-display text-xl font-bold">VEGA</span>
            <span className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
              life.os
            </span>
          </div>
        </div>

        <h1 className="font-display text-4xl font-bold leading-tight tracking-tight">
          A command center for your life.
        </h1>
        <p className="mt-4 font-sans text-sm leading-relaxed text-[var(--color-muted)]">
          Everything you do orbits a <b className="text-[var(--color-ink)]">value</b>. VEGA threads
          them together so the small daily acts ladder up to the life you're actually trying to
          build.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STEPS.map((s, i) => (
            <div
              key={s.v}
              className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-3 shadow-[var(--shadow-soft)]"
            >
              <span className="font-mono text-[10px] uppercase tracking-widest text-[var(--color-muted)]">
                {String(i + 1).padStart(2, "0")}
              </span>
              <p className="mt-1 font-display text-base font-semibold">{s.v}</p>
              <p className="mt-1 font-sans text-[11px] leading-snug text-[var(--color-muted)]">
                {s.d}
              </p>
            </div>
          ))}
        </div>

        <label className="mt-8 flex flex-col gap-1.5 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3">
          <span className="font-sans text-[10px] font-medium uppercase tracking-wide text-[var(--color-muted)]">
            Operator name
          </span>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void finish("demo");
            }}
            placeholder="What should we call you?"
            className="w-full bg-transparent font-sans text-[15px] outline-none placeholder:text-[var(--color-muted)]"
          />
        </label>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={busy}
            onClick={() => finish("demo")}
            className="flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] py-3 font-sans text-sm font-medium text-[var(--color-accent-foreground)] transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Icon name="spark" size={14} /> Explore with sample data
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => finish("empty")}
            className="flex flex-1 items-center justify-center gap-2 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] py-3 font-sans text-sm font-medium text-[var(--color-ink)] transition-colors hover:border-[var(--color-accent)] disabled:opacity-50"
          >
            <Icon name="plus" size={14} /> Start empty
          </button>
        </div>
        <p className="mt-4 text-center font-mono text-[10px] text-[var(--color-muted)]">
          Local-first · your data stays in this browser · switch anytime in Settings
        </p>
      </motion.div>
    </div>
  );
}
