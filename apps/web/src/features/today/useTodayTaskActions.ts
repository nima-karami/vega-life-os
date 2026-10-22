import { useEffect, useState } from "react";
import { pulseHaptic } from "@/core/lib/haptics";
import { useStore } from "@/core/store";
import { getTaskLineage } from "@/features/tasks/lineage";
import type { Task } from "@/features/tasks/model";
import { isResolved } from "@/features/tasks/selectors";
import { useValueVoteToast } from "@/features/values/useValueVoteToast";
import { buildVoteMessage, type VoteMessage } from "@/features/values/vote-message";
import {
  describeHabitToggle,
  describeTaskCompletion,
  reorderTasksInDay,
  toggleDone,
} from "./today-logic";
import { useDoneSettle } from "./useDoneSettle";

const UNDO_WINDOW_MS = 6000;

function resolveVote(task: Task): VoteMessage | null {
  const { values, goals, habits } = useStore.getState();
  const { value } = getTaskLineage(task, { values, goals, habits });
  return value ? buildVoteMessage(value) : null;
}

/** The Today page's task writes, with the screen-reader announcement and delete-undo they drive. */
export function useTodayTaskActions(tasks: Task[], viewDate: string) {
  const setStatus = useStore((s) => s.setStatus);
  const updateTask = useStore((s) => s.updateTask);
  const removeTask = useStore((s) => s.removeTask);
  const addTask = useStore((s) => s.addTask);
  const announceVote = useValueVoteToast();
  const settle = useDoneSettle(viewDate);

  const [editing, setEditing] = useState<Task | null>(null);
  const [announce, setAnnounce] = useState("");
  const [pendingUndo, setPendingUndo] = useState<Task | null>(null);

  useEffect(() => {
    if (!pendingUndo) return;
    const timerId = setTimeout(() => setPendingUndo(null), UNDO_WINDOW_MS);
    return () => clearTimeout(timerId);
  }, [pendingUndo]);

  function handleToggleDone(task: Task) {
    const next = toggleDone(task);
    setStatus(task.id, next);
    const vote = next === "done" ? resolveVote(task) : null;
    if (next !== "done") settle.undo(task.id);
    else {
      pulseHaptic();
      // a skipped row is already in Done, so it completes in place with no hold
      if (!isResolved(task)) settle.complete(task.id, vote !== null);
    }
    setAnnounce(describeTaskCompletion(task.title, next, vote));
  }

  function handleToggleHabit(task: Task) {
    const next = toggleDone(task);
    setStatus(task.id, next);
    if (next === "done") announceVote(task);
    setAnnounce(describeHabitToggle(task.title, next));
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
    handleToggleHabit,
    handleSkip,
    handleUnskip,
    handleReorderTasks,
    handleDelete,
  };
}
