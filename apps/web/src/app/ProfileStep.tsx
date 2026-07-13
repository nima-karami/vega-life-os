import { Button } from "@heroui/react";
import { motion, useReducedMotion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/core/store";

export function ProfileStep() {
  const setOperatorName = useStore((s) => s.setOperatorName);
  const [name, setName] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => inputRef.current?.focus(), []);
  const reduce = useReducedMotion();
  const canContinue = name.trim() !== "";

  const submit = () => {
    if (!canContinue) return;
    setOperatorName(name.trim());
  };

  return (
    <div className="safe-inset-x grid min-h-dvh place-items-center bg-background px-4 py-10 text-foreground">
      <motion.div
        initial={reduce ? false : { opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <h1 className="text-3xl font-semibold tracking-tight">What should we call you?</h1>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          The name VEGA shows across the app. You can change it later in settings.
        </p>
        <form
          className="mt-8 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-foreground">Your name</span>
            <input
              ref={inputRef}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Nima"
              className="w-full rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
            />
          </label>
          <Button
            type="submit"
            variant="primary"
            size="lg"
            isDisabled={!canContinue}
            className="w-full"
          >
            Continue
          </Button>
          {!canContinue && (
            <p className="text-center text-xs text-muted">Enter a name to continue.</p>
          )}
        </form>
      </motion.div>
    </div>
  );
}
