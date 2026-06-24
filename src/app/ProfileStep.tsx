import { Button, Input } from "@heroui/react";
import { motion, useReducedMotion } from "framer-motion";
import { useState } from "react";
import { useStore } from "@/core/store";

export function ProfileStep() {
  const setOperatorName = useStore((s) => s.setOperatorName);
  const [name, setName] = useState("");
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
        <p className="mt-2 text-small leading-relaxed text-default-500">
          The name VEGA shows across the app. You can change it later in settings.
        </p>
        <form
          className="mt-8 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <Input
            autoFocus
            label="Your name"
            labelPlacement="outside"
            value={name}
            onValueChange={setName}
            placeholder="e.g. Nima"
            variant="bordered"
            radius="md"
          />
          <Button
            type="submit"
            color="primary"
            size="lg"
            isDisabled={!canContinue}
            className="w-full"
          >
            Continue
          </Button>
          {!canContinue && (
            <p className="text-center text-tiny text-default-400">Enter a name to continue.</p>
          )}
        </form>
      </motion.div>
    </div>
  );
}
