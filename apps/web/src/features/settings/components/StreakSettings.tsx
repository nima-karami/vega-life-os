import { useEffect, useId, useState } from "react";
import { useStore } from "@/core/store";
import { cx, Icon } from "@/core/ui";
import {
  getPreset,
  PRESET_LABEL,
  PRESET_ORDER,
  PRESETS,
  type PresetName,
  RULE_RANGE,
  type StreakRules,
  validateRules,
} from "@/features/streaks";
import { SettingsCard } from "../SettingsCard";

const NUMBER_FIELD =
  "w-20 rounded-[10px] border border-border bg-surface px-2 py-1.5 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent";

const PRESET_HINT: Record<PresetName, string> = {
  strict: "No grace, no mending — a single miss breaks the chain.",
  balanced: "One grace day; a lone slip on a long run heals after 3 comebacks.",
  forgiving: "Two grace days; slips heal faster and more often.",
};

/**
 * One global streak-rules panel governing habit AND reflection (journal/gratitude)
 * streaks. Presets cover the common cases; Advanced exposes the raw knobs.
 */
export function StreakSettings() {
  const rules = useStore((s) => s.streakRules);
  const setRules = useStore((s) => s.setStreakRules);
  const pushToast = useStore((s) => s.pushToast);
  const [draft, setDraft] = useState<StreakRules>(rules);
  const [advanced, setAdvanced] = useState(false);
  const advId = useId();

  // Re-sync if the rules change elsewhere (sign-in hydration, another device).
  useEffect(() => setDraft(rules), [rules]);

  const errors = validateRules(draft);
  const errorFor = (f: keyof StreakRules) => errors.find((e) => e.field === f)?.message;
  const active = getPreset(draft);

  const applyPreset = (name: PresetName) => {
    setDraft(PRESETS[name]);
    setRules(PRESETS[name]);
    pushToast(`Streak rules: ${PRESET_LABEL[name]}`);
  };
  const patch = (p: Partial<StreakRules>) => {
    const next = { ...draft, ...p };
    setDraft(next);
    if (validateRules(next).length === 0) setRules(next);
  };

  return (
    <SettingsCard
      title="Streak rules"
      description="How streaks mend after a missed day — applied to habits, journaling, and gratitude alike."
    >
      <div className="flex flex-col gap-5">
        {/* presets */}
        <div>
          <fieldset className="flex flex-wrap gap-2" aria-label="Streak rule preset">
            {PRESET_ORDER.map((name) => {
              const on = active === name;
              return (
                <button
                  type="button"
                  key={name}
                  onClick={() => applyPreset(name)}
                  aria-pressed={on}
                  className={cx(
                    "rounded-[12px] border px-3 py-2 text-sm outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                    on
                      ? "border-accent text-foreground"
                      : "border-border text-muted hover:border-muted",
                  )}
                >
                  {PRESET_LABEL[name]}
                </button>
              );
            })}
            {active === "custom" && (
              <span className="self-center rounded-[12px] border border-dashed border-border px-3 py-2 text-sm text-muted">
                Custom
              </span>
            )}
          </fieldset>
          <p className="mt-2 text-xs leading-relaxed text-muted">
            {active === "custom" ? "Your own tuned rules." : PRESET_HINT[active]}
          </p>
        </div>

        {/* advanced disclosure */}
        <div>
          <button
            type="button"
            onClick={() => setAdvanced((v) => !v)}
            aria-expanded={advanced}
            aria-controls={advId}
            className="flex items-center gap-1.5 text-sm text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
          >
            <Icon name={advanced ? "chevD" : "chevR"} size={15} />
            Advanced
          </button>

          {advanced && (
            <div id={advId} className="mt-4 flex flex-col gap-4">
              <NumberRow
                label="Grace days"
                hint="Days you can still log a missed day on time."
                value={draft.graceDays}
                range={RULE_RANGE.graceDays}
                error={errorFor("graceDays")}
                onChange={(v) => patch({ graceDays: v })}
              />

              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <span className="text-sm font-medium text-foreground">Mend long streaks</span>
                  <p className="mt-0.5 text-xs text-muted">
                    Bridge a single slip on a long run instead of resetting to zero.
                  </p>
                </div>
                <fieldset className="flex shrink-0 gap-1" aria-label="Mend long streaks">
                  {[true, false].map((v) => (
                    <button
                      type="button"
                      key={String(v)}
                      onClick={() => patch({ bridgeEnabled: v })}
                      aria-pressed={draft.bridgeEnabled === v}
                      className={cx(
                        "rounded-[10px] border px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent",
                        draft.bridgeEnabled === v
                          ? "border-accent text-foreground"
                          : "border-border text-muted hover:border-muted",
                      )}
                    >
                      {v ? "On" : "Off"}
                    </button>
                  ))}
                </fieldset>
              </div>

              {draft.bridgeEnabled && (
                <>
                  <NumberRow
                    label="Long-run minimum"
                    hint="How long a streak must be before a slip can be bridged."
                    value={draft.longStreakMin}
                    range={RULE_RANGE.longStreakMin}
                    error={errorFor("longStreakMin")}
                    onChange={(v) => patch({ longStreakMin: v })}
                  />
                  <NumberRow
                    label="Comebacks to heal"
                    hint="Consecutive completions that re-earn a bridged streak."
                    value={draft.recoveryLen}
                    range={RULE_RANGE.recoveryLen}
                    error={errorFor("recoveryLen")}
                    onChange={(v) => patch({ recoveryLen: v })}
                  />
                  <NumberRow
                    label="Mend cooldown (days)"
                    hint="Minimum days between two bridges."
                    value={draft.mendCooldownDays}
                    range={RULE_RANGE.mendCooldownDays}
                    error={errorFor("mendCooldownDays")}
                    onChange={(v) => patch({ mendCooldownDays: v })}
                  />
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </SettingsCard>
  );
}

function NumberRow({
  label,
  hint,
  value,
  range,
  error,
  onChange,
}: {
  label: string;
  hint: string;
  value: number;
  range: { min: number; max: number };
  error?: string;
  onChange: (v: number) => void;
}) {
  const id = useId();
  const hintId = `${id}-hint`;
  return (
    <div className="flex items-start justify-between gap-4">
      <label htmlFor={id} className="min-w-0">
        <span className="text-sm font-medium text-foreground">{label}</span>
        <p id={hintId} className="mt-0.5 text-xs text-muted">
          {hint}
        </p>
        {error && (
          <p className="mt-0.5 text-xs text-danger" role="alert">
            {error}
          </p>
        )}
      </label>
      <input
        id={id}
        type="number"
        inputMode="numeric"
        min={range.min}
        max={range.max}
        value={value}
        aria-describedby={hintId}
        aria-invalid={error != null}
        onChange={(e) => onChange(Math.round(Number(e.target.value)))}
        className={NUMBER_FIELD}
      />
    </div>
  );
}
