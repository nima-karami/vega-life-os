/**
 * The done moment's hold: a completed Today row stays in Remaining while its check,
 * vote and drain play, then the whole batch leaves for Done together. Pure state
 * transitions; `useDoneSettle` owns the timers.
 */
import type { CardAnim, CardDensity, TaskCardMotion } from "@/features/tasks/task-card";

type SettlePhase = "vote" | "post" | "leaving";

/** The value a row voted for, and whether it repeated a vote still on screen. */
export interface VoteMark {
  valueId: string;
  isRepeat: boolean;
}

export interface SettleState {
  /** ids held in Remaining */
  phases: ReadonlyMap<string, SettlePhase>;
  /** ids whose keyframes may run; a row remounted in Done has none, so nothing replays */
  anims: ReadonlyMap<string, CardAnim>;
  /** ids playing the arrive animation */
  arriving: ReadonlySet<string>;
  /** kept until the row lands, so a fading headline never changes its words */
  votes: ReadonlyMap<string, VoteMark>;
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
  votes: new Map(),
};

const VOTE_HOLD_MS: Record<CardDensity, number> = { card: 2100, compact: 1500 };
const SETTLE_AFTER_VOTE_MS: Record<CardDensity, number> = { card: 2900, compact: 2100 };
const SETTLE_AFTER_PLAIN_MS = 1200;
export const SETTLE_RETRY_MS = 400;
export const LEAVE_MS = 280;
export const ARRIVE_MS = 320;
export const UNDO_ANIM_MS = 600;

export function getVoteHold(density: CardDensity): number {
  return VOTE_HOLD_MS[density];
}

export function getSettleDelay(hasVote: boolean, density: CardDensity): number {
  return hasVote ? SETTLE_AFTER_VOTE_MS[density] : SETTLE_AFTER_PLAIN_MS;
}

/** The shared batch waits for its slowest row, so a quicker complete never pulls it earlier. */
export function extendSettleDeadline(
  deadline: number | null,
  now: number,
  delayMs: number,
): number {
  return Math.max(deadline ?? 0, now + delayMs);
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

export function isVoteShowing(state: SettleState, valueId: string): boolean {
  for (const [id, phase] of state.phases)
    if (phase === "vote" && state.votes.get(id)?.valueId === valueId) return true;
  return false;
}

export function startComplete(state: SettleState, id: string, vote: VoteMark | null): SettleState {
  return {
    phases: withEntry(state.phases, id, vote ? "vote" : "post"),
    anims: withEntry(state.anims, id, "complete"),
    arriving: withMember(state.arriving, id, false),
    votes: withEntry(state.votes, id, vote),
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
    ...state,
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
    votes: withEntry(state.votes, id, null),
  };
}

export function clearAnim(state: SettleState, id: string, anim: CardAnim): SettleState {
  if (state.anims.get(id) !== anim) return state;
  return {
    ...state,
    anims: withEntry(state.anims, id, null),
    votes: withEntry(state.votes, id, null),
  };
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

/** A held row set back to To do or skipped elsewhere stops settling at once; same state if none. */
export function dropStaleSettles(state: SettleState, isDone: (id: string) => boolean): SettleState {
  const staleIds = [...state.phases.keys()].filter((id) => !isDone(id));
  return staleIds.length === 0 ? state : staleIds.reduce(cancelSettle, state);
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
  const votes = new Map(state.votes);
  for (const id of ids) {
    if (phases.get(id) !== "leaving") continue;
    phases.delete(id);
    anims.delete(id);
    votes.delete(id);
    arriving.add(id);
  }
  return { phases, anims, arriving, votes };
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
    isRepeatVote: state.votes.get(id)?.isRepeat ?? false,
    travel: getTravel(state, id),
  };
}
