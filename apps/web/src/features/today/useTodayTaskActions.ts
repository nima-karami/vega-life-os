import { useEffect, useState } from "react";
import { useStore } from "@/core/store";
import type { Task, TaskStatus } from "@/features/tasks/model";
import { useValueVoteToast } from "@/features/values/useValueVoteToast";
import {
  describeHabitToggle,
  describeTaskToggle,
  reorderTasksInDay,
  toggleDone,
} from "./today-logic";

const UNDO_WINDOW_MS = 6000;

/** The Today page's task writes, with the screen-reader announcement and delete-undo they drive. */
export function useTodayTaskActions(tasks: Task[], viewDate: string) {
  const setStatus = useStore((s) => s.setStatus);
  const updateTask = useStore((s) => s.updateTask);
  const removeTask = useStore((s) => s.removeTask);
  const addTask = useStore((s) => s.addTask);
  const announceVote = useValueVoteToast();

  const [editing, setEditing] = useState<Task | null>(null);
  const [announce, setAnnounce] = useState("");
  const [pendingUndo, setPendingUndo] = useState<Task | null>(null);

  useEffect(() => {
    if (!pendingUndo) return;
    const timerId = setTimeout(() => setPendingUndo(null), UNDO_WINDOW_MS);
    return () => clearTimeout(timerId);
  }, [pendingUndo]);

  function applyToggle(task: Task): TaskStatus {
    const next = toggleDone(task);
    setStatus(task.id, next);
    if (next === "done") announceVote(task);
    return next;
  }

  function handleToggleDone(task: Task) {
    setAnnounce(describeTaskToggle(applyToggle(task)));
  }

  function handleToggleHabit(task: Task) {
    setAnnounce(describeHabitToggle(task.title, applyToggle(task)));
  }

  function handleSkip(task: Task) {
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
    handleToggleDone,
    handleToggleHabit,
    handleSkip,
    handleUnskip,
    handleReorderTasks,
    handleDelete,
  };
}
