import { Button, Input } from "@heroui/react";
import { useState } from "react";
import {
  AGENT_MODELS,
  getAgentModel,
  getAnthropicKey,
  setAgentModel,
  setAnthropicKey,
} from "@/core/agent";
import { useStore } from "@/core/store";
import { cx, Icon } from "@/core/ui";
import { SettingsCard } from "../SettingsCard";

export function AgentSettings() {
  const pushToast = useStore((s) => s.pushToast);
  const [key, setKey] = useState(getAnthropicKey());
  const [model, setModel] = useState(getAgentModel());

  const save = () => {
    setAnthropicKey(key.trim());
    pushToast(key.trim() ? "Claude agent enabled" : "Key cleared — local agent");
  };
  const pick = (m: string) => {
    setModel(m);
    setAgentModel(m);
  };

  return (
    <SettingsCard
      title="Agent · ⌘K intelligence"
      description="Paste an Anthropic API key to make ⌘K reason over your real data (plan the week, triage the backlog). Stored only in this browser; calls go straight to Anthropic. Without a key, ⌘K uses the built-in offline parser."
    >
      <div className="flex flex-col gap-5">
        <Input
          type="password"
          label="Anthropic API key"
          labelPlacement="outside"
          value={key}
          onValueChange={setKey}
          placeholder="sk-ant-…"
          variant="bordered"
          radius="md"
          classNames={{ input: "font-mono" }}
        />
        <div>
          <span className="font-sans text-sm font-medium text-[var(--color-ink)]">Model</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {AGENT_MODELS.map((m) => {
              const active = model === m.id;
              return (
                <button
                  type="button"
                  key={m.id}
                  onClick={() => pick(m.id)}
                  aria-pressed={active}
                  className={cx(
                    "rounded-[var(--radius-sm)] border px-3.5 py-2 font-sans text-sm transition-colors",
                    active
                      ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
                      : "border-[var(--color-line)] text-[var(--color-ink)] hover:border-[var(--color-line-strong)]",
                  )}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
        <div>
          <Button
            className="bg-[var(--color-accent)] font-sans text-[var(--color-accent-foreground)]"
            startContent={<Icon name="spark" size={15} />}
            onPress={save}
          >
            Save key
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}
