import { motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/core/store";
import { cx, Icon, Label } from "@/core/ui";

const STEPS = [
  { v: "Value", d: "What you stand for — your gravitational centers." },
  { v: "Goal", d: "A finish line that serves a value." },
  { v: "Habit", d: "The repeated act that moves a goal, or just keeps a value alive." },
  { v: "Task", d: "The atom you actually check off today." },
];

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
    <div className="hud-grid-bg grid h-screen place-items-center bg-paper px-4 text-ink">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg"
      >
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-10 w-10 place-items-center bg-ink text-paper">
            <span className="display text-xl leading-none">V</span>
          </span>
          <div>
            <span className="display text-xl">VEGA</span>
            <span className="label ml-2">// life.os</span>
          </div>
        </div>

        <h1 className="display text-4xl leading-tight">A command center for your life.</h1>
        <p className="mono mt-3 text-[12px] leading-relaxed text-stone">
          Everything you do orbits a <b className="text-ink">value</b>. VEGA threads them together
          so the small daily acts ladder up to the life you're actually trying to build.
        </p>

        <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.v} className="panel-flush p-3">
              <Label>{String(i + 1).padStart(2, "0")}</Label>
              <p className="display mt-1 text-base">{s.v}</p>
              <p className="mono mt-1 text-[9px] leading-snug text-stone">{s.d}</p>
            </div>
          ))}
        </div>

        <label className="mt-6 flex flex-col gap-1.5 border border-[var(--color-line)] px-3 py-2.5">
          <Label>operator name</Label>
          <input
            ref={nameRef}
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") void finish("demo");
            }}
            placeholder="What should we call you?"
            className="mono w-full bg-transparent text-[15px] outline-none placeholder:text-mist"
          />
        </label>

        <div className="mt-5 flex flex-col gap-2 sm:flex-row">
          <button
            type="button"
            disabled={busy}
            onClick={() => finish("demo")}
            className={cx("btn-solid btn flex flex-1 items-center justify-center gap-2 py-3")}
          >
            <Icon name="spark" size={14} /> Explore with sample data
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => finish("empty")}
            className="btn flex flex-1 items-center justify-center gap-2 py-3"
          >
            <Icon name="plus" size={14} /> Start empty
          </button>
        </div>
        <p className="mono mt-3 text-center text-[10px] text-mist">
          Local-first · your data stays in this browser · switch anytime in Settings
        </p>
      </motion.div>
    </div>
  );
}
