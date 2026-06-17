import { useState } from "react";
import {
  AGENT_MODELS,
  getAgentModel,
  getAnthropicKey,
  setAgentModel,
  setAnthropicKey,
} from "@/core/agent";
import { useStore } from "@/core/store";
import { Button, cx, Label, Panel, SectionHead } from "@/core/ui";

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
    <Panel className="mb-4 p-5">
      <SectionHead title="agent · ⌘K intelligence" />
      <p className="mono mt-3 text-[11px] leading-relaxed text-stone">
        Paste an Anthropic API key to make ⌘K reason over your real data (plan the week, triage the
        backlog). Stored only in this browser; calls go straight to Anthropic. Without a key, ⌘K
        uses the built-in offline parser.
      </p>
      <div className="mt-4 flex flex-col gap-3">
        <label className="flex flex-col gap-1.5 border border-[var(--color-line)] px-3 py-2.5">
          <Label>anthropic api key</Label>
          <input
            type="password"
            value={key}
            onChange={(e) => setKey(e.target.value)}
            placeholder="sk-ant-…"
            className="mono w-full bg-transparent text-[13px] outline-none placeholder:text-mist"
          />
        </label>
        <div>
          <Label>model</Label>
          <div className="mt-2 flex flex-wrap gap-2">
            {AGENT_MODELS.map((m) => (
              <button
                type="button"
                key={m.id}
                onClick={() => pick(m.id)}
                className={cx(
                  "mono border px-3 py-2 text-[11px] uppercase tracking-[0.08em]",
                  model === m.id
                    ? "border-ink bg-ink text-paper"
                    : "border-[var(--color-line)] text-stone hover:border-ink",
                )}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>
        <div>
          <Button solid icon="spark" onClick={save}>
            Save key
          </Button>
        </div>
      </div>
    </Panel>
  );
}
