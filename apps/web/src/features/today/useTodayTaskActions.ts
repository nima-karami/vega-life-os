import { useCallback, useEffect, useState } from "react";
import { pulseHaptic } from "@/core/lib/haptics";
import { useStore } from "@/core/store";
import { getTaskLineage } from "@/features/tasks/lineage";
import type { Task } from "@/features/tasks/model";
import { isResolved } from "@/features/tasks/selectors";
import type { Value } from "@/features/values/model";
import { buildVoteMessage } from "@/features/values/vote-message";
import {
  describeTaskCompletion,
  getTaskDensity,
  reorderTasksInDay,
  toggleDone,
} from "./today-logic";
import { type DoneSettle, useDoneSettle } from "./useDoneSettle";

const UNDO_WINDOW_MS = 6000;

function resolveValue(task: Task): Value | undefined {
  const { values, goals, habits } = useStore.getState();
  return getTaskLineage(task, { values, goals, habits }).value;
}

/** Holds a fresh complete for its done moment and returns the vote it showed, if any. */
function holdCompletion(settle: DoneSettle, task: Task) {
  const value = resolveValue(task);
  const vote = settle.complete(task.id, value?.id ?? null, getTaskDensity(task));
  return value && vote ? buildVoteMessage(value, vote.isRepeat) : null;
}

/** The Today page's task writes, with the screen-reader announcement and delete-undo they drive. */
export function useTodayTaskActions(tasks: Task[], viewDate: string) {
  const setStatus = useStore((s) => s.setStatus);
  const updateTask = useStore((s) => s.updateTask);
  const removeTask = useStore((s) => s.removeTask);
  const addTask = useStore((s) => s.addTask);
  const settle = useDoneSettle(viewDate);

  const [editing, setEditing] = useState<Task | null>(null);
  const [announce, setAnnouncement] = useState({ text: "", key: 0 });
  // a fresh node per announcement, so a repeat of the same text is still read
  const setAnnounce = useCallback(
    (text: string) => setAnnouncement((prev) => ({ text, key: prev.key + 1 })),
    [],
  );
  const [pendingUndo, setPendingUndo] = useState<Task | null>(null);

  useEffect(() => {
    if (!pendingUndo) return;
    const timerId = setTimeout(() => setPendingUndo(null), UNDO_WINDOW_MS);
    return () => clearTimeout(timerId);
  }, [pendingUndo]);

  function handleToggleDone(task: Task) {
    const next = toggleDone(task);
    setStatus(task.id, next);
    if (next !== "done") settle.undo(task.id);
    else pulseHaptic();
    // a skipped row is already in Done, so it completes in place with no hold and no vote
    const isHeld = next === "done" && !isResolved(task);
    const vote = isHeld ? holdCompletion(settle, task) : null;
    setAnnounce(describeTaskCompletion(task.title, next, vote));
  }

  function handleSkip(task: Task) {
    settle.cancel(task.id);
    setStatus(task.id, "skip");
    setAnnounce("Skipped");
  }

  function handleUnskip(task: Task) {
    setStatus(task.id, "todo");
    setAnnounce("Marked not done");
  }

  function handleReorderTasks(activeId: string, overId: string) {
    const updates = reorderTasksInDay(tasks, viewDate, activeId, overId);
    if (updates.length === 0) return;
    for (const u of updates) updateTask(u.id, { order: u.order });
    setAnnounce("Tasks reordered");
  }

  function handleDelete(task: Task) {
    settle.cancel(task.id);
    removeTask(task.id);
    if (editing?.id === task.id) setEditing(null);
    setAnnounce("Task deleted");
    setPendingUndo(task);
  }

  function undoDelete() {
    if (!pendingUndo) return;
    addTask({ ...pendingUndo });
    setAnnounce("Restored task");
    setPendingUndo(null);
  }

  return {
    editing,
    setEditing,
    announce,
    setAnnounce,
    pendingUndo,
    undoDelete,
    settlingIds: settle.settlingIds,
    getMotion: settle.getMotion,
    handleToggleDone,
    handleSkip,
    handleUnskip,
    handleReorderTasks,
    handleDelete,
  };
}
