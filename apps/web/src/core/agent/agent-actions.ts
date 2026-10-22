import { todayISO } from "@/core/lib/date";
import type { IconName } from "@/core/lib/icon-names";
import type { RootState } from "@/core/store";
import type { Goal } from "@/features/goals/model";
import type { Task } from "@/features/tasks/model";
import type { AgentAction } from "./types";

type ClosingStatus = "done" | "skip";

const CLOSING_COPY: Record<ClosingStatus, { icon: IconName; verb: string; past: string }> = {
  done: { icon: "check", verb: "Complete", past: "Completed" },
  skip: { icon: "skip", verb: "Skip", past: "Skipped" },
};

const describeWhen = (date: string | null | undefined, time: string | null | undefined) => {
  const day = date ? ` · ${date === todayISO() ? "today" : date.slice(5)}` : " · backlog";
  return `${day}${time ? ` ${time}` : ""}`;
};

export const formatAddTaskLabel = (
  title: string,
  date: string | null | undefined,
  time: string | null | undefined,
) => `Add task: "${title}"${describeWhen(date, time)}`;

export const buildCloseTaskAction = (
  state: RootState,
  task: Task,
  status: ClosingStatus,
  id: string,
): AgentAction => {
  const copy = CLOSING_COPY[status];
  return {
    id,
    icon: copy.icon,
    label: `${copy.verb}: ${task.title}`,
    run: () => {
      state.setStatus(task.id, status);
      state.pushToast(`${copy.past} "${task.title}"`);
    },
  };
};

export const buildPlanWeekAction = (state: RootState, id: string): AgentAction => ({
  id,
  icon: "flash",
  label: "Plan this week (fill habit blocks)",
  run: () => {
    const planned = state.planWeek();
    state.pushToast(planned ? `Planned ${planned} blocks` : "Week already full");
  },
});

export const buildFocusGoalAction = (
  state: RootState,
  goal: Goal,
  id: string,
  icon: IconName,
): AgentAction => ({
  id,
  icon,
  label: `Focus: ${goal.name}`,
  run: () => {
    state.setFocusGoal(goal.id);
    state.pushToast(`Focused on ${goal.name}`);
  },
});
