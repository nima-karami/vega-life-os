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
            <p className="mt-2 text-small leading-relaxed text-default-500">
              Sync your data to your account across devices.
            </p>
            <div className="mt-8">
              <AuthForm autoFocus />
            </div>
            <button
              type="button"
              onClick={() => setStep("intro")}
              className="mt-6 text-tiny text-default-500 transition-colors hover:text-foreground"
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
            <p className="mt-4 text-small leading-relaxed text-default-500">
              Everything you do orbits a <b className="text-foreground">value</b>. VEGA threads them
              together so the small daily acts ladder up to the life you're actually trying to
              build.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {STEPS.map((s, i) => (
                <div
                  key={s.v}
                  className="rounded-medium border border-divider bg-content1 p-3 shadow-small"
                >
                  <span className="text-tiny text-default-400">
                    {String(i + 1).padStart(2, "0")}
                  </span>
                  <p className="mt-1 text-medium font-semibold">{s.v}</p>
                  <p className="mt-1 text-tiny leading-snug text-default-500">{s.d}</p>
                </div>
              ))}
            </div>

            {firebaseEnabled ? (
              <button
                type="button"
                onClick={() => setStep("auth")}
                className="mt-8 flex w-full items-center justify-center gap-2 rounded-medium bg-primary py-3 text-small font-medium text-primary-foreground transition-opacity hover:opacity-90"
              >
                <Icon name="user" size={14} /> Sign in or create account
              </button>
            ) : (
              <p className="mt-8 rounded-medium border border-divider bg-content1 px-4 py-3 text-small leading-relaxed text-default-500">
                Cloud sign-in isn't configured on this build. You can explore VEGA with sample data
                below.
              </p>
            )}

            <div className="mt-3">
              <button
                type="button"
                disabled={busy}
                onClick={() => void explore()}
                className="flex w-full items-center justify-center gap-2 rounded-medium border border-divider bg-content1 py-3 text-small font-medium text-foreground transition-colors hover:border-primary disabled:opacity-50"
              >
                <Icon name="spark" size={14} /> Explore with sample data
              </button>
            </div>

            <p className="mt-4 text-center text-tiny text-default-400">
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
      <span className="grid h-10 w-10 place-items-center rounded-medium bg-primary text-primary-foreground">
        <span className="text-xl font-semibold leading-none">V</span>
      </span>
      <div className="flex items-baseline gap-2">
        <span className="text-xl font-semibold">VEGA</span>
        <span className="text-tiny text-default-500">life os</span>
      </div>
    </div>
  );
}
