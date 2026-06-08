import type { IconName } from "@/core/lib/icon-names";

export interface Subgoal {
  id: string;
  name: string;
  done: boolean;
}

export interface Goal {
  id: string;
  valueId: string;
  name: string;
  icon: IconName;
  /** ISO date (yyyy-mm-dd) */
  start: string;
  /** ISO date (yyyy-mm-dd) */
  end: string;
  /** 0..1 headline progress (can be set or derived from subgoals) */
  progress: number;
  subgoals: Subgoal[];
  order: number;
}
