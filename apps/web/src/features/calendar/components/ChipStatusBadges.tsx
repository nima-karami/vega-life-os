import { Icon } from "@/core/ui";

export function ChipStatusBadges({
  isDetached,
  isOffWindow,
}: {
  isDetached: boolean;
  isOffWindow: boolean;
}) {
  if (!isDetached && !isOffWindow) return null;
  return (
    <span className="absolute right-1 top-1 flex items-center gap-0.5 text-muted">
      {isDetached && (
        <span title="Edited away from its habit" aria-hidden="true">
          <Icon name="unlink" size={10} />
        </span>
      )}
      {isOffWindow && (
        <span title="Outside the visible hours" aria-hidden="true">
          <Icon name="alert" size={10} />
        </span>
      )}
    </span>
  );
}
