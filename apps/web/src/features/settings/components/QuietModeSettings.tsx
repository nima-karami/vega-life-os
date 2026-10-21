import { Switch } from "@heroui/react";
import { useQuietMode, useStore } from "@/core/store";
import { SettingsCard } from "../SettingsCard";

export function QuietModeSettings() {
  const isQuiet = useQuietMode();
  const setQuietMode = useStore((s) => s.setQuietMode);

  return (
    <SettingsCard
      title="Quiet mode"
      description="Hide scores, counts and Analytics. Your data keeps recording."
      action={
        <Switch aria-label="Quiet mode" isSelected={isQuiet} onChange={setQuietMode}>
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>
      }
    />
  );
}
