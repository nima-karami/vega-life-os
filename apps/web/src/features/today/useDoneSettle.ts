import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useStore } from "@/core/store";
import type { TaskCardMotion } from "@/features/tasks/task-card";
import {
  ARRIVE_MS,
  cancelSettle,
  clearAnim,
  clearArrival,
  dropStaleSettles,
  EMPTY_SETTLE,
  endVoteHold,
  finishLeaving,
  getCardMotion,
  getSettleDelay,
  getSettlingIds,
  LEAVE_MS,
  planSettle,
  SETTLE_RETRY_MS,
  type SettleState,
  startComplete,
  startLeaving,
  startUndo,
  UNDO_ANIM_MS,
  VOTE_HOLD_MS,
} from "./done-settle";

export interface DoneSettle {
  settlingIds: ReadonlySet<string>;
  getMotion: (taskId: string) => TaskCardMotion | undefined;
  complete: (taskId: string, hasVote: boolean) => void;
  undo: (taskId: string) => void;
  cancel: (taskId: string) => void;
}

type Timers = Map<string, ReturnType<typeof setTimeout>>;

function clearTimers(timers: Timers) {
  for (const timer of timers.values()) clearTimeout(timer);
  timers.clear();
}

function isStoredDone(taskId: string): boolean {
  return useStore.getState().tasks.some((t) => t.id === taskId && t.status === "done");
}

function findFocusedCheckTaskId(): string | null {
  const active = document.activeElement;
  if (!active?.matches(".task-card__check")) return null;
  return active.closest("[data-task-id]")?.getAttribute("data-task-id") ?? null;
}

function focusCheck(taskId: string) {
  const check = document.querySelector<HTMLElement>(
    `[data-task-id="${CSS.escape(taskId)}"] .task-card__check`,
  );
  check?.focus({ preventScroll: true });
}

/** The timers around `done-settle`: hold each completed row, then move the batch to Done. */
export function useDoneSettle(viewDate: string): DoneSettle {
  const [state, setState] = useState<SettleState>(EMPTY_SETTLE);
  const stateRef = useRef(state);
  const timersRef = useRef<Timers>(new Map());
  const refocusIdRef = useRef<string | null>(null);
  const tasks = useStore((s) => s.tasks);

  const commit = useCallback((transition: (current: SettleState) => SettleState) => {
    stateRef.current = transition(stateRef.current);
    setState(stateRef.current);
  }, []);

  const schedule = useCallback((key: string, delayMs: number, run: () => void) => {
    const timers = timersRef.current;
    clearTimeout(timers.get(key));
    timers.set(
      key,
      setTimeout(() => {
        timers.delete(key);
        run();
      }, delayMs),
    );
  }, []);

  const unschedule = useCallback((key: string) => {
    clearTimeout(timersRef.current.get(key));
    timersRef.current.delete(key);
  }, []);

  const keepCheckFocus = useCallback((ids: string[]) => {
    const focusedId = findFocusedCheckTaskId();
    if (focusedId && ids.includes(focusedId)) refocusIdRef.current = focusedId;
  }, []);

  const moveToDone = useCallback(
    (ids: string[]) => {
      const batchKey = ids.join(",");
      commit((current) => startLeaving(current, ids));
      schedule(`move:${batchKey}`, LEAVE_MS, () => {
        keepCheckFocus(ids);
        commit((current) => finishLeaving(current, ids));
        schedule(`arrive-batch:${batchKey}`, ARRIVE_MS, () =>
          commit((current) => clearArrival(current, ids)),
        );
      });
    },
    [commit, schedule, keepCheckFocus],
  );

  const runSettle = useCallback(() => {
    const plan = planSettle(stateRef.current, isStoredDone);
    if (plan.retry) {
      schedule("settle", SETTLE_RETRY_MS, runSettle);
      return;
    }
    commit((current) => plan.staleIds.reduce(cancelSettle, current));
    if (plan.leavingIds.length > 0) moveToDone(plan.leavingIds);
  }, [commit, schedule, moveToDone]);

  const complete = useCallback(
    (taskId: string, hasVote: boolean) => {
      commit((current) => startComplete(current, taskId, hasVote));
      if (hasVote)
        schedule(`vote:${taskId}`, VOTE_HOLD_MS, () =>
          commit((current) => endVoteHold(current, taskId)),
        );
      schedule("settle", getSettleDelay(hasVote), runSettle);
    },
    [commit, schedule, runSettle],
  );

  const undo = useCallback(
    (taskId: string) => {
      const wasInDone = !stateRef.current.phases.has(taskId);
      unschedule(`vote:${taskId}`);
      if (wasInDone) keepCheckFocus([taskId]);
      commit((current) => startUndo(current, taskId));
      schedule(`anim:${taskId}`, UNDO_ANIM_MS, () =>
        commit((current) => clearAnim(current, taskId, "undo")),
      );
      if (wasInDone)
        schedule(`arrive:${taskId}`, ARRIVE_MS, () =>
          commit((current) => clearArrival(current, [taskId])),
        );
    },
    [commit, schedule, unschedule, keepCheckFocus],
  );

  const cancel = useCallback(
    (taskId: string) => {
      unschedule(`vote:${taskId}`);
      commit((current) => cancelSettle(current, taskId));
    },
    [commit, unschedule],
  );

  const liveState = useMemo(() => {
    const doneIds = new Set(tasks.filter((t) => t.status === "done").map((t) => t.id));
    return dropStaleSettles(state, (id) => doneIds.has(id));
  }, [state, tasks]);

  useEffect(() => {
    if (liveState === state) return;
    for (const id of state.phases.keys()) if (!liveState.phases.has(id)) unschedule(`vote:${id}`);
    commit((current) => dropStaleSettles(current, isStoredDone));
  }, [liveState, state, commit, unschedule]);

  useLayoutEffect(() => {
    const taskId = refocusIdRef.current;
    if (taskId === null) return;
    refocusIdRef.current = null;
    focusCheck(taskId);
  });

  const settledDateRef = useRef(viewDate);
  useEffect(() => {
    if (settledDateRef.current === viewDate) return;
    settledDateRef.current = viewDate;
    clearTimers(timersRef.current);
    commit(() => EMPTY_SETTLE);
  }, [viewDate, commit]);

  useEffect(() => {
    const timers = timersRef.current;
    return () => clearTimers(timers);
  }, []);

  const settlingIds = useMemo(() => getSettlingIds(liveState), [liveState]);
  const getMotion = useCallback((taskId: string) => getCardMotion(liveState, taskId), [liveState]);

  return { settlingIds, getMotion, complete, undo, cancel };
}
