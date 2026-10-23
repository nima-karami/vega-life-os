import type { IconName } from "@/core/lib/icon-names";
import { IconField } from "@/core/ui";
import type { SealAnim } from "../seal";
import "./goal-seal.css";

/** The goal page's header disc: flooded with the value's swatch while the goal is done. */
export function GoalSealDisc({
  icon,
  color,
  isSealed,
  anim,
  onSelectIcon,
}: {
  icon: IconName;
  color: string;
  isSealed: boolean;
  anim: SealAnim | null;
  onSelectIcon: (icon: IconName) => void;
}) {
  return (
    <span className="goal-seal" data-sealed={isSealed || undefined} data-anim={anim ?? undefined}>
      <span className="goal-seal__flood" style={{ background: color }} aria-hidden="true" />
      <span
        className="goal-seal__halo"
        style={{ boxShadow: `0 0 0 1.5px ${color}` }}
        aria-hidden="true"
      />
      <IconField
        value={icon}
        label="Goal icon"
        onSelect={onSelectIcon}
        triggerClassName="relative rounded-[12px] text-foreground"
        triggerStyle={{ width: 44, height: 44 }}
        iconClassName="goal-seal__icon"
        iconSize={20}
      />
    </span>
  );
}
