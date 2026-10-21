/**
 * /values — every value as a colour-filled card carrying its own goals and habits.
 *
 * The card is the value, so opening one is a route (`/values/:id`), not a modal;
 * adding a value or a goal creates it and lands on its page. Archived values keep
 * their non-destructive `archivedAt` lifecycle behind a quiet disclosure.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { useRegisterCommands } from "@/app/commands";
import { reorderByIds } from "@/core/lib/reorder";
import { useStore } from "@/core/store";
import { AddButton, CreateNameDialog, Disclosure, SortableList } from "@/core/ui";
import { DeleteValueDialog } from "./components/DeleteValueDialog";
import { ValueIndexCard } from "./components/ValueIndexCard";
import type { Value } from "./model";
import { getArchivedValues, splitValuesBySeason } from "./selectors";
import { useAnnouncer } from "./useAnnouncer";
import { useValueSeason } from "./useValueSeason";

export function ValuesView() {
  const navigate = useNavigate();
  const values = useStore((s) => s.values);
  const addValue = useStore((s) => s.addValue);
  const addGoal = useStore((s) => s.addGoal);
  const updateValue = useStore((s) => s.updateValue);
  const archiveValue = useStore((s) => s.archiveValue);
  const unarchiveValue = useStore((s) => s.unarchiveValue);
  const pushToast = useStore((s) => s.pushToast);

  const [confirmValue, setConfirmValue] = useState<Value | null>(null);

  const { announce, region } = useAnnouncer();
  const { toggleSeason } = useValueSeason();
  const addBtnRef = useRef<HTMLButtonElement>(null);

  const { inSeason, resting } = useMemo(() => splitValuesBySeason(values), [values]);
  const archived = useMemo(() => getArchivedValues(values), [values]);

  // Naming it is the save: a mis-tapped button must not leave a nameless row behind.
  const [pendingCreate, setPendingCreate] = useState<{
    kind: "value" | "goal";
    valueId?: string;
  } | null>(null);

  const createValue = useCallback(() => setPendingCreate({ kind: "value" }), []);

  const createGoal = useCallback(
    (valueId?: string) => setPendingCreate({ kind: "goal", valueId }),
    [],
  );

  const commitCreate = useCallback(
    (name: string) => {
      if (pendingCreate === null) return;
      if (pendingCreate.kind === "value") {
        navigate(`/values/${addValue({ name }).id}`);
      } else {
        const patch = pendingCreate.valueId ? { valueId: pendingCreate.valueId, name } : { name };
        navigate(`/goals/${addGoal(patch).id}`);
      }
      setPendingCreate(null);
    },
    [pendingCreate, addValue, addGoal, navigate],
  );

  useRegisterCommands([
    {
      id: "values-new-value",
      label: "New value",
      icon: "tree",
      keywords: "new value create add",
      run: ({ close }) => {
        createValue();
        close();
      },
    },
    {
      id: "values-new-goal",
      label: "New goal",
      icon: "target",
      keywords: "new goal create add",
      run: ({ close }) => {
        createGoal();
        close();
      },
    },
  ]);

  const reorderGroup = useCallback(
    (group: Value[]) => (activeId: string, overId: string) => {
      for (const c of reorderByIds(group, activeId, overId)) updateValue(c.id, { order: c.order });
      announce("Values reordered");
    },
    [updateValue, announce],
  );

  const toggleValueSeason = useCallback(
    (value: Value) => {
      const message = toggleSeason(value);
      if (message) announce(message);
    },
    [toggleSeason, announce],
  );

  const toggleArchive = useCallback(
    (value: Value) => {
      const wasArchived = value.archivedAt !== null;
      if (wasArchived) unarchiveValue(value.id);
      else archiveValue(value.id);
      const message = wasArchived ? "Value unarchived" : "Value archived";
      pushToast(message);
      announce(message);
    },
    [archiveValue, unarchiveValue, pushToast, announce],
  );

  const emptyMessage =
    resting.length > 0
      ? "Nothing in season right now — bring a value back when you're ready."
      : archived.length > 0
        ? `No active values — ${archived.length} archived.`
        : 'No values yet — the "why" behind every goal and task downstream.';

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      {region}

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          What you're building toward
        </h1>
        <p className="mt-1 text-sm text-muted">
          Goals ladder up to a value — each with a timeframe and a state. Habits keep them moving.
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-5">
        <AddButton ref={addBtnRef} label="Add value" onPress={createValue} />

        {inSeason.length === 0 ? (
          <p className="text-sm text-muted">{emptyMessage}</p>
        ) : (
          <SortableList
            items={inSeason}
            getId={(v) => v.id}
            getLabel={(v) => v.name}
            onReorder={reorderGroup(inSeason)}
            className="space-y-5"
            longPress
            renderItem={(v) => (
              <ValueIndexCard
                value={v}
                archived={false}
                onAddGoal={() => createGoal(v.id)}
                onArchiveToggle={() => toggleArchive(v)}
                onSeasonToggle={() => toggleValueSeason(v)}
                onDelete={() => setConfirmValue(v)}
                onAnnounce={announce}
              />
            )}
          />
        )}

        <Disclosure
          label="resting"
          count={resting.length}
          onToggle={(open) => announce(open ? "Showing resting values" : "Resting values hidden")}
        >
          <p className="mb-3 text-xs text-muted">
            Resting values keep their goals and habits — they just step out of the weekly check-in
            for now.
          </p>
          <SortableList
            items={resting}
            getId={(v) => v.id}
            getLabel={(v) => v.name}
            onReorder={reorderGroup(resting)}
            className="space-y-5"
            longPress
            renderItem={(v) => (
              <ValueIndexCard
                value={v}
                archived={false}
                resting
                onAddGoal={() => createGoal(v.id)}
                onArchiveToggle={() => toggleArchive(v)}
                onSeasonToggle={() => toggleValueSeason(v)}
                onDelete={() => setConfirmValue(v)}
                onAnnounce={announce}
              />
            )}
          />
        </Disclosure>

        <Disclosure
          label="archived"
          count={archived.length}
          onToggle={(open) => announce(open ? "Showing archived values" : "Archived values hidden")}
        >
          <div className="space-y-5">
            {archived.map((v) => (
              <ValueIndexCard
                key={v.id}
                value={v}
                archived
                onAddGoal={() => {}}
                onArchiveToggle={() => toggleArchive(v)}
                onSeasonToggle={() => {}}
                onDelete={() => setConfirmValue(v)}
                onAnnounce={announce}
              />
            ))}
          </div>
        </Disclosure>
      </div>

      <DeleteValueDialog
        value={confirmValue}
        onClose={() => setConfirmValue(null)}
        onDeleted={() => {
          announce("Value deleted");
          addBtnRef.current?.focus();
        }}
      />

      <CreateNameDialog
        open={pendingCreate !== null}
        title={pendingCreate?.kind === "goal" ? "New goal" : "New value"}
        label={pendingCreate?.kind === "goal" ? "Goal name" : "Value name"}
        placeholder={pendingCreate?.kind === "goal" ? "Run a half marathon" : "Health"}
        confirmLabel="Create"
        onCreate={commitCreate}
        onClose={() => setPendingCreate(null)}
      />
    </div>
  );
}
