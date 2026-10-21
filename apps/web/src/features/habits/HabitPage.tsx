import { Button } from "@heroui/react";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import type { IconName } from "@/core/lib/icon-names";
import { useStore } from "@/core/store";
import { EntityBreadcrumb, Icon, IconField, Menu, type MenuItem } from "@/core/ui";
import { getValueCardFill, getValueColor } from "@/features/values/color";
import { ValueWhy } from "@/features/values/components/ValueWhy";
import { ArchivedBanner } from "./ArchivedBanner";
import { buildHabitTrail } from "./breadcrumb";
import { DeleteHabitDialog } from "./DeleteHabitDialog";
import { HabitDayRecord } from "./HabitDayRecord";
import { HabitFields } from "./HabitFields";
import { buildHabitMeta } from "./habit-meta";
import { HABIT_LIFECYCLE_LABEL, type Habit, type HabitLifecycle, habitLifecycle } from "./model";
import { buildHabitDayRecord } from "./selectors";
import { useHabitLifecycle } from "./useHabitLifecycle";

const RECORD_DAYS = 30;

const STATUS_ICON: Record<HabitLifecycle, IconName> = {
  active: "sparkles",
  paused: "pause",
  archived: "archive",
};

export function HabitPage() {
  const { habitId } = useParams();
  const habit = useStore((s) => s.habits.find((h) => h.id === habitId));

  if (!habit) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
        <EntityBreadcrumb trail={[{ label: "Habits", to: "/habits" }]} />
        <p className="mt-6 text-muted text-sm">This habit no longer exists.</p>
      </div>
    );
  }
  return <HabitDetail habit={habit} />;
}

function HabitDetail({ habit }: { habit: Habit }) {
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const value = values.find((v) => v.id === habit.valueId);
  const tasks = useStore((s) => s.tasks);
  const updateHabit = useStore((s) => s.updateHabit);
  const unarchiveHabit = useStore((s) => s.unarchiveHabit);
  const pushToast = useStore((s) => s.pushToast);
  const navigate = useNavigate();
  const [isDeleting, setDeleting] = useState(false);

  const lifecycle = habitLifecycle(habit);
  const isArchived = lifecycle === "archived";
  const meta = useMemo(() => buildHabitMeta(tasks, habit), [tasks, habit]);
  const record = useMemo(() => buildHabitDayRecord(tasks, habit, RECORD_DAYS), [tasks, habit]);

  const renameHabit = (name: string) => updateHabit(habit.id, { name });

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <EntityBreadcrumb trail={buildHabitTrail(habit, { values, goals })} />

      <header className="mt-3.5 flex items-start gap-3.5">
        <IconField
          value={habit.icon}
          onSelect={(icon) => updateHabit(habit.id, { icon })}
          isDisabled={isArchived}
          triggerClassName="rounded-full text-white"
          triggerStyle={{ background: getValueColor(value), width: 44, height: 44 }}
          iconSize={20}
        />
        <div className="min-w-0 flex-1">
          <h1>
            <input
              type="text"
              aria-label="Habit name"
              value={habit.name}
              maxLength={120}
              disabled={isArchived}
              onChange={(e) => renameHabit(e.target.value)}
              onBlur={(e) => {
                if (!e.target.value.trim()) renameHabit("New habit");
              }}
              className="w-full border-transparent border-b bg-transparent font-semibold text-2xl text-foreground tracking-tight outline-none focus:border-accent"
            />
          </h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2 text-muted text-xs">
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-[9px] py-[3px] text-accent">
              <Icon name={STATUS_ICON[lifecycle]} size={11} aria-hidden />
              {HABIT_LIFECYCLE_LABEL[lifecycle]}
            </span>
            {meta.map((m) => (
              <span key={m.text}>{m.text}</span>
            ))}
          </div>
        </div>
        <HabitActionsMenu habit={habit} lifecycle={lifecycle} onDelete={() => setDeleting(true)} />
      </header>

      {value && (
        <div className="mt-5">
          <ValueWhy value={value} />
        </div>
      )}

      {habit.plan !== "" && <p className="mt-4 text-muted text-sm">Plan: {habit.plan}</p>}

      <section className="mt-6">
        {habit.tracked ? (
          <>
            <span className="block text-muted text-xs">The last thirty days</span>
            <div className="mt-2.5">
              <HabitDayRecord days={record} color={getValueCardFill(value)} />
            </div>
          </>
        ) : (
          <p className="text-muted text-sm">Not tracked — just do it when it fits.</p>
        )}
      </section>

      <div className="mt-8 flex flex-col gap-6">
        {isArchived && (
          <ArchivedBanner
            onUnarchive={() => {
              unarchiveHabit(habit.id);
              pushToast("Habit unarchived");
            }}
          />
        )}
        <HabitFields habit={habit} />
      </div>

      <footer className="mt-9 border-border border-t pt-5">
        <Button variant="ghost" className="px-0 text-danger" onPress={() => setDeleting(true)}>
          <Icon name="trash" size={14} />
          Delete habit
        </Button>
      </footer>

      {isDeleting && (
        <DeleteHabitDialog
          habit={habit}
          isOpen
          onClose={() => setDeleting(false)}
          onDeleted={() => navigate("/habits", { replace: true })}
        />
      )}
    </div>
  );
}

function HabitActionsMenu({
  habit,
  lifecycle,
  onDelete,
}: {
  habit: Habit;
  lifecycle: HabitLifecycle;
  onDelete: () => void;
}) {
  const setLifecycle = useHabitLifecycle(habit, lifecycle);

  const items: MenuItem[] = [
    ...(lifecycle === "active"
      ? [{ label: "Pause", icon: "pause", onSelect: () => setLifecycle("paused") } as MenuItem]
      : []),
    ...(lifecycle === "paused"
      ? [{ label: "Resume", icon: "play", onSelect: () => setLifecycle("active") } as MenuItem]
      : []),
    lifecycle === "archived"
      ? { label: "Unarchive", icon: "upload", onSelect: () => setLifecycle("active") }
      : { label: "Archive", icon: "clipboard", onSelect: () => setLifecycle("archived") },
    { label: "Delete", icon: "trash", onSelect: onDelete, danger: true },
  ];

  return (
    <Menu
      align="end"
      isIconOnly
      triggerLabel={`Actions for ${habit.name}`}
      triggerClassName="shrink-0"
      triggerContent={<Icon name="dots" size={16} />}
      items={items}
    />
  );
}
