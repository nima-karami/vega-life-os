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
    <div className="grid h-screen place-items-center bg-background px-4 text-foreground">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg"
      >
        <div className="mb-8 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center rounded-medium bg-primary text-primary-foreground">
            <span className="text-xl font-semibold leading-none">V</span>
          </span>
          <div className="flex items-baseline gap-2">
            <span className="text-xl font-semibold">VEGA</span>
            <span className="text-tiny text-default-500">life os</span>
          </div>
        </div>

        <h1 className="text-4xl font-semibold leading-tight tracking-tight">
          A command center for your life.
        </h1>
        <p className="mt-4 text-small leading-relaxed text-default-500">
          Everything you do orbits a <b className="text-foreground">value</b>. VEGA threads them
          together so the small daily acts ladder up to the life you're actually trying to build.
        </p>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {STEPS.map((s, i) => (
            <div
              key={s.v}
              className="rounded-medium border border-divider bg-content1 p-3 shadow-small"
            >
              <span className="text-tiny text-default-400">{String(i + 1).padStart(2, "0")}</span>
              <p className="mt-1 text-medium font-semibold">{s.v}</p>
              <p className="mt-1 text-tiny leading-snug text-default-500">{s.d}</p>
            </div>
          ))}
        </div>

        <label className="mt-8 flex flex-col gap-1.5 rounded-medium border border-divider bg-content1 px-4 py-3">
          <span className="text-tiny text-default-500">Operator name</span>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void finish("demo");
            }}
            placeholder="What should we call you?"
            className="w-full bg-transparent text-medium outline-none placeholder:text-default-400"
          />
        </label>

        <div className="mt-6 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={busy}
            onClick={() => finish("demo")}
            className="flex flex-1 items-center justify-center gap-2 rounded-medium bg-primary py-3 text-small font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            <Icon name="spark" size={14} /> Explore with sample data
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => finish("empty")}
            className="flex flex-1 items-center justify-center gap-2 rounded-medium border border-divider bg-content1 py-3 text-small font-medium text-foreground transition-colors hover:border-primary disabled:opacity-50"
          >
            <Icon name="plus" size={14} /> Start empty
          </button>
        </div>
        <p className="mt-4 text-center text-tiny text-default-400">
          Local-first · your data stays in this browser · switch anytime in Settings
        </p>
      </motion.div>
    </div>
  );
}
