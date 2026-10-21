import { DoneGroupList } from "@/features/tasks/components/DoneGroupList";
import type { DoneGroup } from "@/features/tasks/done-groups";

export function DoneTodayStep({ groups }: { groups: DoneGroup[] }) {
  if (groups.length === 0) {
    return (
      <p className="text-sm text-muted">
        Nothing ticked off today. That's allowed. Rest and the unplanned count too.
      </p>
    );
  }
  return <DoneGroupList groups={groups} />;
}
