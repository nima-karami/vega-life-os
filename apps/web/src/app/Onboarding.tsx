import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { firebaseEnabled } from "@/core/auth";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";
import { AuthForm } from "./AuthForm";

const STEPS = [
  { v: "Value", d: "What you stand for — your gravitational centers." },
  { v: "Goal", d: "A finish line that serves a value." },
  { v: "Habit", d: "The repeated act that moves a goal, or just keeps a value alive." },
  { v: "Task", d: "The atom you actually check off today." },
];

export function Onboarding() {
  const seedDemo = useStore((s) => s.seedDemo);
  const setOnboarded = useStore((s) => s.setOnboarded);
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<"intro" | "auth">("intro");
  const reduce = useReducedMotion();

  const explore = async () => {
    setBusy(true);
    try {
      await seedDemo();
      setOnboarded(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="safe-inset-x grid min-h-dvh place-items-center bg-background px-4 py-10 text-foreground">
      <motion.div
        key={step}
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-lg"
      >
        {step === "auth" ? (
          <>
            <Brand />
            <h1 className="text-3xl font-semibold tracking-tight">
              Sign in or create your account
            </h1>
            <p className="mt-2 text-sm leading-relaxed text-muted">
              Sync your data to your account across devices.
            </p>
            <div className="mt-8">
              <AuthForm autoFocus />
            </div>
            <button
              type="button"
              onClick={() => setStep("intro")}
              className="mt-6 text-xs text-muted transition-colors hover:text-foreground"
            >
              ← Back
            </button>
          </>
        ) : (
          <>
            <Brand />
            <h1 className="text-4xl font-semibold leading-tight tracking-tight">
              A command center for your life.
            </h1>
            <p className="mt-4 text-sm leading-relaxed text-muted">
              Everything you do orbits a <b className="text-foreground">value</b>. VEGA threads them
              together so the small daily acts ladder up to the life you're actually trying to
              build.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {STEPS.map((s, i) => (
                <div
                  key={s.v}
                  className="rounded-[12px] border border-border bg-surface p-3 shadow-sm"
                >
                  <span className="text-xs text-muted">{String(i + 1).padStart(2, "0")}</span>
                  <p className="mt-1 text-base font-semibold">{s.v}</p>
                  <p className="mt-1 text-xs leading-snug text-muted">{s.d}</p>
                </div>
              ))}
            </div>

            {firebaseEnabled ? (
              <button
                type="button"
                onClick={() => setStep("auth")}
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-[12px] bg-accent py-3 text-sm font-medium text-accent-foreground transition-opacity hover:opacity-90"
              >
                <Icon name="user" size={14} /> Sign in or create account
              </button>
            ) : (
              <p className="mt-8 rounded-[12px] border border-border bg-surface px-4 py-3 text-sm leading-relaxed text-muted">
                Cloud sign-in isn't configured on this build. You can explore VEGA with sample data
                below.
              </p>
            )}

            <div className="mt-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void explore()}
                className="flex w-full items-center justify-center gap-2 rounded-[12px] border border-border bg-surface py-3 text-sm font-medium text-foreground transition-colors hover:border-accent disabled:opacity-50"
              >
                <Icon name="spark" size={14} /> Explore with sample data
              </button>
            </div>

            <p className="mt-4 text-center text-xs text-muted">
              Your data syncs to your account. Sample data stays on this device only.
            </p>
          </>
        )}
      </motion.div>
    </div>
  );
}

function Brand() {
  return (
    <div className="mb-8 flex items-center gap-3">
      <span className="grid h-10 w-10 place-items-center rounded-[12px] bg-accent text-accent-foreground">
        <span className="text-xl font-semibold leading-none">V</span>
      </span>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-semibold">VEGA</span>
        <span className="text-xs text-muted">life os</span>
      </div>
    </div>
  );
}
