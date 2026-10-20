import { Icon } from "@/core/ui";
import { useValueColor } from "@/features/values/useValueColor";
import { collapseHabitItems, type DoneGroup } from "../done-groups";

function GroupHeading({ group }: { group: DoneGroup }) {
  const color = useValueColor(group.value?.id);
  return (
    <h3 className="flex items-center gap-2 text-sm font-medium text-foreground">
      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
      {group.value?.name ?? "Other"}
    </h3>
  );
}

export function DoneGroupList({ groups }: { groups: DoneGroup[] }) {
  return (
    <div className="flex flex-col gap-4">
      {groups.map((group) => (
        <section key={group.value?.id ?? "other"} className="flex flex-col gap-1.5">
          <GroupHeading group={group} />
          <ul className="flex flex-col gap-1">
            {collapseHabitItems(group.tasks).map((item) => (
              <li key={item.key} className="flex items-start gap-2 text-sm text-muted">
                <Icon name="check" size={12} className="mt-1 shrink-0" />
                {item.label}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
