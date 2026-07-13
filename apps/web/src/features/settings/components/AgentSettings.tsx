import { Button } from "@heroui/react";
import { useState } from "react";
import {
  AGENT_MODELS,
  getAgentModel,
  getAnthropicKey,
  setAgentModel,
  setAnthropicKey,
} from "@/core/agent";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";
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
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Anthropic API key</span>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-ant-…"
            className="w-full rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
          />
        </label>
        <div>
          <span className="text-sm font-medium text-foreground">Model</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {AGENT_MODELS.map((m) => {
              const active = model === m.id;
              return (
                <Button
                  key={m.id}
                  size="sm"
                  variant={active ? "primary" : "outline"}
                  aria-pressed={active}
                  onPress={() => pick(m.id)}
                >
                  {m.label}
                </Button>
              );
            })}
          </div>
        </div>
        <div>
          <Button variant="primary" onPress={save}>
            <Icon name="spark" size={15} />
            Save key
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}
