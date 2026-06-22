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
        <Input
          type="password"
          label="Anthropic API key"
          labelPlacement="outside"
          value={key}
          onValueChange={setKey}
          placeholder="sk-ant-…"
          variant="bordered"
          radius="md"
        />
        <div>
          <span className="text-small font-medium text-foreground">Model</span>
          <div className="mt-2 flex flex-wrap gap-2">
            {AGENT_MODELS.map((m) => {
              const active = model === m.id;
              return (
                <Button
                  key={m.id}
                  size="sm"
                  variant={active ? "solid" : "bordered"}
                  color={active ? "primary" : "default"}
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
          <Button color="primary" startContent={<Icon name="spark" size={15} />} onPress={save}>
            Save key
          </Button>
        </div>
      </div>
    </SettingsCard>
  );
}
