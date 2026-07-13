import type { IconName } from "@/core/lib/icon-names";

export interface Subgoal {
  id: string;
  name: string;
  done: boolean;
}

export type GoalStatus = "backlog" | "active" | "paused" | "done" | "abandoned";

export const GOAL_STATUSES: GoalStatus[] = ["backlog", "active", "paused", "done", "abandoned"];

export const GOAL_STATUS_LABEL: Record<GoalStatus, string> = {
  backlog: "Backlog",
  active: "Active",
  paused: "Paused",
  done: "Done",
  abandoned: "Abandoned",
};

/** done & abandoned are "closed" — no longer being actively worked */
export const isGoalClosed = (s: GoalStatus) => s === "done" || s === "abandoned";

export interface Goal {
  id: string;
  valueId: string;
  name: string;
  icon: IconName;
  status: GoalStatus;
  /** ISO date (yyyy-mm-dd) */
  start: string;
  /** ISO date (yyyy-mm-dd) */
  end: string;
  /** 0..1 headline progress (can be set or derived from subgoals) */
  progress: number;
  subgoals: Subgoal[];
  order: number;
}
