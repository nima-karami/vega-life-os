import { ListBox } from "@heroui/react";
import type { Key } from "react";
import { useStore } from "@/core/store";
import { Icon, Popover } from "@/core/ui";
import type { Goal } from "@/features/goals";
import { CalendarsSection } from "./CalendarsSection";
import {
  ALL_FOCUS_ID,
  buildFocusOptions,
  computeCalendarFilterBadgeCount,
  resolveFocusSelection,
} from "./filter-model";

const FOCUS_ROW_CLASS =
  "flex items-center justify-between gap-2 rounded-[var(--radius-floating-row)] px-[9px] py-[7px] text-[13.5px] text-foreground outline-none data-[selected=true]:bg-surface-secondary";

/** The one place the grid is narrowed: goal focus, plus Google calendars when connected. */
export function CalendarFilterButton({ focusableGoals }: { focusableGoals: Goal[] }) {
  const focusGoalId = useStore((s) => s.focusGoalId);
  const setFocusGoal = useStore((s) => s.setFocusGoal);
  const gcalStatus = useStore((s) => s.gcalStatus);
  const focusOptions = buildFocusOptions(focusableGoals);
  const badgeCount = computeCalendarFilterBadgeCount({ focusGoalId, gcalStatus });

  return (
    <Popover
      align="end"
      triggerLabel={badgeCount > 0 ? `Filter (${badgeCount} active)` : "Filter"}
      triggerClassName="relative rounded-[8px] p-1.5 text-muted transition-colors hover:bg-surface-secondary hover:text-foreground"
      triggerContent={
        <>
          <Icon name="filter" size={15} />
          {badgeCount > 0 && (
            <span
              aria-hidden
              className="-top-1 -right-1 absolute flex h-4 min-w-4 items-center justify-center rounded-full bg-accent px-1 font-semibold text-[10px] text-accent-foreground leading-none"
            >
              {badgeCount}
            </span>
          )}
        </>
      }
      className="w-64"
    >
      <div className="flex w-full flex-col gap-2.5 p-3">
        {focusOptions.length > 0 && (
          <div className="flex w-full flex-col gap-1.5">
            <p className="text-xs font-medium text-muted">Focus</p>
            <ListBox
              aria-label="Focus"
              selectionMode="single"
              selectedKeys={[focusGoalId ?? ALL_FOCUS_ID]}
              className="w-full"
              onSelectionChange={(keys) => {
                const [first] = [...(keys as Set<Key>)];
                if (first != null) setFocusGoal(resolveFocusSelection(String(first)));
              }}
            >
              {focusOptions.map((option) => (
                <ListBox.Item
                  key={option.id}
                  id={option.id}
                  textValue={option.label}
                  className={FOCUS_ROW_CLASS}
                >
                  {option.label}
                  <ListBox.Item.Indicator />
                </ListBox.Item>
              ))}
            </ListBox>
          </div>
        )}
        <CalendarsSection />
      </div>
    </Popover>
  );
}
