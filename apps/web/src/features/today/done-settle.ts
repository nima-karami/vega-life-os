/**
 * The done moment's hold: a completed Today row stays in Remaining while its check,
 * vote and drain play, then the whole batch leaves for Done together. Pure state
 * transitions; `useDoneSettle` owns the timers.
 */
import type { CardAnim, TaskCardMotion } from "@/features/tasks/task-card";

type SettlePhase = "vote" | "post" | "leaving";

export interface SettleState {
  /** ids held in Remaining */
  phases: ReadonlyMap<string, SettlePhase>;
  /** ids whose keyframes may run; a row remounted in Done has none, so nothing replays */
  anims: ReadonlyMap<string, CardAnim>;
  /** ids playing the arrive animation */
  arriving: ReadonlySet<string>;
}

export interface SettlePlan {
  retry: boolean;
  leavingIds: string[];
  staleIds: string[];
}

export const EMPTY_SETTLE: SettleState = {
  phases: new Map(),
  anims: new Map(),
  arriving: new Set(),
};

export const VOTE_HOLD_MS = 2100;
export const SETTLE_AFTER_VOTE_MS = 2900;
export const SETTLE_AFTER_PLAIN_MS = 1200;
export const SETTLE_RETRY_MS = 400;
export const LEAVE_MS = 280;
export const ARRIVE_MS = 320;
export const UNDO_ANIM_MS = 600;

export function getSettleDelay(hasVote: boolean): number {
  return hasVote ? SETTLE_AFTER_VOTE_MS : SETTLE_AFTER_PLAIN_MS;
}

function withEntry<V>(map: ReadonlyMap<string, V>, id: string, entry: V | null): Map<string, V> {
  const next = new Map(map);
  if (entry === null) next.delete(id);
  else next.set(id, entry);
  return next;
}

function withMember(set: ReadonlySet<string>, id: string, isMember: boolean): Set<string> {
  const next = new Set(set);
  if (isMember) next.add(id);
  else next.delete(id);
  return next;
}

export function startComplete(state: SettleState, id: string, hasVote: boolean): SettleState {
  return {
    phases: withEntry(state.phases, id, hasVote ? "vote" : "post"),
    anims: withEntry(state.anims, id, "complete"),
    arriving: withMember(state.arriving, id, false),
  };
}

export function endVoteHold(state: SettleState, id: string): SettleState {
  if (state.phases.get(id) !== "vote") return state;
  return { ...state, phases: withEntry(state.phases, id, "post") };
}

/** A row with no phase was already showing in Done, so it travels back. */
export function startUndo(state: SettleState, id: string): SettleState {
  const wasInDone = !state.phases.has(id);
  return {
    phases: withEntry(state.phases, id, null),
    anims: withEntry(state.anims, id, "undo"),
    arriving: withMember(state.arriving, id, wasInDone),
  };
}

export function cancelSettle(state: SettleState, id: string): SettleState {
  return {
    phases: withEntry(state.phases, id, null),
    anims: withEntry(state.anims, id, null),
    arriving: withMember(state.arriving, id, false),
  };
}

export function clearAnim(state: SettleState, id: string, anim: CardAnim): SettleState {
  if (state.anims.get(id) !== anim) return state;
  return { ...state, anims: withEntry(state.anims, id, null) };
}

/** Nothing leaves while any row is mid-vote, so rows never shift under a showing message. */
export function planSettle(state: SettleState, isDone: (id: string) => boolean): SettlePlan {
  const held = [...state.phases];
  if (held.some(([, phase]) => phase === "vote"))
    return { retry: true, leavingIds: [], staleIds: [] };
  return {
    retry: false,
    leavingIds: held.filter(([id, phase]) => phase === "post" && isDone(id)).map(([id]) => id),
    staleIds: held.filter(([id]) => !isDone(id)).map(([id]) => id),
  };
}

export function startLeaving(state: SettleState, ids: string[]): SettleState {
  const phases = new Map(state.phases);
  for (const id of ids) phases.set(id, "leaving");
  return { ...state, phases };
}

export function finishLeaving(state: SettleState, ids: string[]): SettleState {
  const phases = new Map(state.phases);
  const anims = new Map(state.anims);
  const arriving = new Set(state.arriving);
  for (const id of ids) {
    if (phases.get(id) !== "leaving") continue;
    phases.delete(id);
    anims.delete(id);
    arriving.add(id);
  }
  return { phases, anims, arriving };
}

export function clearArrival(state: SettleState, ids: string[]): SettleState {
  const arriving = new Set(state.arriving);
  for (const id of ids) arriving.delete(id);
  return { ...state, arriving };
}

export function getSettlingIds(state: SettleState): ReadonlySet<string> {
  return new Set(state.phases.keys());
}

function getTravel(state: SettleState, id: string): TaskCardMotion["travel"] {
  if (state.phases.get(id) === "leaving") return "leave";
  return state.arriving.has(id) ? "arrive" : null;
}

export function getCardMotion(state: SettleState, id: string): TaskCardMotion | undefined {
  const isTracked = state.phases.has(id) || state.anims.has(id) || state.arriving.has(id);
  if (!isTracked) return undefined;
  return {
    anim: state.anims.get(id) ?? null,
    isVoting: state.phases.get(id) === "vote",
    travel: getTravel(state, id),
  };
}
