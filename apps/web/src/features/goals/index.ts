export type { Goal, GoalStatus, Subgoal } from "./model";
export { GOAL_STATUS_ICON, GOAL_STATUS_LABEL, GOAL_STATUSES, isGoalClosed } from "./model";
export {
  buildStatusChangePatch,
  computeGoalProgressPercent,
  formatGoalFigures,
  getGoalPaceBadge,
  isGoalProgressDerived,
  type PaceBadge,
} from "./presentation";
export * from "./selectors";
export { createGoalsSlice, type GoalsSlice } from "./store";
export { detectTimeframe, formatPeriodLabel, getPresetRange, type Timeframe } from "./timeframe";
