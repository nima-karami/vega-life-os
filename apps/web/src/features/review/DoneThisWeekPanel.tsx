import { Panel } from "@/core/ui";
import { DoneGroupList } from "@/features/tasks/components/DoneGroupList";
import type { DoneGroup } from "@/features/tasks/done-groups";

export function DoneThisWeekPanel({
  groups,
  isThisWeek,
}: {
  groups: DoneGroup[];
  isThisWeek: boolean;
}) {
  return (
    <Panel className="p-4 sm:p-5">
      <h3 className="text-sm font-medium text-foreground">
        {isThisWeek ? "Here's what you did this week." : "Here's what you did."}
      </h3>
      <div className="mt-3">
        {groups.length > 0 ? (
          <DoneGroupList groups={groups} />
        ) : (
          <p className="text-sm text-muted">
            A quiet week on the list. Anything worth remembering can still go below.
          </p>
        )}
      </div>
    </Panel>
  );
}
