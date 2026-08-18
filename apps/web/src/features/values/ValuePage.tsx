/** /values/:valueId — the value itself is the editor: the title is the name field,
 *  and its goals and habits stand as cards in its own colour. */
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { reorderByIds } from "@/core/lib/reorder";
import { useStore } from "@/core/store";
import { CreateNameDialog, Icon, IconField, Menu, SortableList } from "@/core/ui";
import { GoalEntityCard } from "@/features/goals/components/GoalEntityCard";
import { getValueColor, VALUE_HUES } from "./color";
import { DeleteValueDialog } from "./components/DeleteValueDialog";
import { NoteField, TitleField } from "./components/DetailFields";
import {
  DetailAction,
  DetailFooter,
  DetailHeader,
  DetailPage,
  DetailSection,
  VALUES_ROOT,
} from "./components/DetailPage";
import { HuePicker } from "./components/editor-bits";
import { HabitSection } from "./components/HabitSection";
import type { Value } from "./model";

export function ValuePage() {
  const { valueId } = useParams();
  const value = useStore((s) => s.values.find((v) => v.id === valueId));

  if (!value)
    return (
      <DetailPage trail={[VALUES_ROOT]}>
        <p className="mt-8 text-sm text-muted">This value no longer exists.</p>
      </DetailPage>
    );

  return <ValueDetail value={value} />;
}

function ValueDetail({ value }: { value: Value }) {
  const navigate = useNavigate();
  const goals = useStore((s) => s.goals);
  const habits = useStore((s) => s.habits);
  const update = useStore((s) => s.updateValue);
  const updateGoal = useStore((s) => s.updateGoal);
  const addGoal = useStore((s) => s.addGoal);
  const addHabit = useStore((s) => s.addHabit);
  const archiveValue = useStore((s) => s.archiveValue);
  const unarchiveValue = useStore((s) => s.unarchiveValue);
  const pushToast = useStore((s) => s.pushToast);

  const [confirmDelete, setConfirmDelete] = useState(false);
  // Naming it is the save — a stray tap must not leave a nameless goal or habit behind.
  const [pendingCreate, setPendingCreate] = useState<"goal" | "habit" | null>(null);

  const valueGoals = goals.filter((g) => g.valueId === value.id).sort((a, b) => a.order - b.order);
  const valueHabits = habits.filter((h) => h.valueId === value.id);
  const isArchived = value.archivedAt !== null;

  const reorderGoals = (activeId: string, overId: string) => {
    for (const c of reorderByIds(valueGoals, activeId, overId))
      updateGoal(c.id, { order: c.order });
  };

  const toggleArchive = () => {
    if (isArchived) unarchiveValue(value.id);
    else archiveValue(value.id);
    pushToast(isArchived ? "Value unarchived" : "Value archived");
  };

  return (
    <DetailPage trail={[VALUES_ROOT]}>
      <DetailHeader
        disc={
          <IconField
            value={value.icon}
            label="Value icon"
            onSelect={(icon) => update(value.id, { icon })}
            triggerClassName="rounded-full border border-transparent hover:border-foreground/30"
            triggerStyle={{ background: getValueColor(value), width: 44, height: 44 }}
            iconClassName="text-white"
            iconSize={20}
          />
        }
        title={
          <TitleField
            value={value.name}
            label="Value name"
            placeholder="New value"
            onChange={(name) => update(value.id, { name })}
          />
        }
        actions={
          <Menu
            align="end"
            isIconOnly
            triggerLabel="Value actions"
            triggerContent={<Icon name="dots" size={16} />}
            items={[
              {
                label: isArchived ? "Unarchive value" : "Archive value",
                icon: "archive",
                onSelect: toggleArchive,
              },
              {
                label: "Delete value",
                icon: "trash",
                danger: true,
                onSelect: () => setConfirmDelete(true),
              },
            ]}
          />
        }
      />

      <NoteField
        value={value.desc}
        label="What it means to you"
        placeholder="A sentence on why this matters…"
        onChange={(desc) => update(value.id, { desc })}
      />

      <div className="mt-8 flex flex-col gap-6">
        <DetailSection label="Card colour">
          <HuePicker
            value={getValueColor(value)}
            options={VALUE_HUES}
            onSelect={(hue) => update(value.id, { hue })}
          />
          <p className="mt-2 text-xs text-muted">
            Every goal and habit in service of this value is filled with it.
          </p>
        </DetailSection>

        <DetailSection label="Goals" caps>
          <SortableList
            items={valueGoals}
            getId={(g) => g.id}
            getLabel={(g) => g.name}
            onReorder={reorderGoals}
            className="space-y-3"
            renderItem={(g) => <GoalEntityCard goal={g} value={value} />}
          />
          <div className="mt-1">
            <DetailAction icon="plus" label="Add goal" onPress={() => setPendingCreate("goal")} />
          </div>
        </DetailSection>

        <HabitSection habits={valueHabits} value={value} onAdd={() => setPendingCreate("habit")} />
      </div>

      <DetailFooter>
        <DetailAction
          icon="archive"
          label={isArchived ? "Unarchive value" : "Archive value"}
          onPress={toggleArchive}
        />
        <DetailAction
          icon="trash"
          danger
          label="Delete value"
          onPress={() => setConfirmDelete(true)}
        />
      </DetailFooter>

      <CreateNameDialog
        open={pendingCreate !== null}
        title={pendingCreate === "habit" ? "New habit" : "New goal"}
        label={pendingCreate === "habit" ? "Habit name" : "Goal name"}
        placeholder={pendingCreate === "habit" ? "Read for 20 minutes" : "Run a half marathon"}
        confirmLabel="Create"
        onClose={() => setPendingCreate(null)}
        onCreate={(name) => {
          const created =
            pendingCreate === "habit"
              ? `/habits/${addHabit({ valueId: value.id, name }).id}`
              : `/goals/${addGoal({ valueId: value.id, name }).id}`;
          setPendingCreate(null);
          navigate(created);
        }}
      />

      <DeleteValueDialog
        value={confirmDelete ? value : null}
        onClose={() => setConfirmDelete(false)}
        onDeleted={() => navigate("/values")}
      />
    </DetailPage>
  );
}
