import type { Card, CardPrefs } from "@vega/shared";
import { buildFeedPool } from "../feed-pool";
import {
  buildFeedQueue,
  computePassSeed,
  createPassReader,
  FAILED_REAPPEAR_LIMIT,
  FAILED_REAPPEAR_OFFSET,
  isRecapId,
  NO_REPEAT_WINDOW,
  type PassReader,
  type QueueEntry,
} from "../queue";

/** A queue entry stamped with the pass that built it, so a React key survives an edit to the tail. */
export type DeckEntry = QueueEntry & { passIndex: number };

/** The pass still being read in: how many chunks are in the deck, and what was pulled out of the rest. */
type OpenPass = { readChunk: PassReader; chunksRead: number; pulledIds: readonly string[] };

/**
 * The planned session. Materialised once and thereafter only appended to, pruned, or
 * relocated: grading a card must never re-derive what is already planned ahead of the user.
 * A pass is planned in full order up front but read into `entries` a chunk at a time.
 */
export type DeckPlan = {
  entries: DeckEntry[];
  passCount: number;
  reappears: Record<string, number>;
  openPass: OpenPass | null;
};

export type DeckSource = { cards: Card[]; prefs: CardPrefs; today: string; baseSeed: number };

export const EMPTY_DECK: DeckPlan = { entries: [], passCount: 0, reappears: {}, openPass: null };

export const PASS_CHUNK_SIZE = 200;
// The deck has no trailing recap to chain off, so nearing the end is the extend trigger.
const PASS_EXTEND_THRESHOLD = 2;
// Inside a pass the next chunk lands early enough that a failed card's return slot is always planned.
const CHUNK_EXTEND_THRESHOLD = FAILED_REAPPEAR_OFFSET * 2;

/** The feed's own deck, minus the trailing recap entry — BrainWrite is a card and nothing else. */
export function buildBrainWriteQueue(
  cards: Card[],
  prefs: CardPrefs,
  today: string,
  options: { seed: number; exclude?: string[] },
): QueueEntry[] {
  const entries = buildFeedQueue(buildFeedPool(cards, prefs, today), {
    seed: options.seed,
    today,
    exclude: options.exclude,
  });
  return entries.filter((entry) => !isRecapId(entry.cardId));
}

const hasUnreadChunk = (pass: OpenPass): boolean => pass.readChunk(pass.chunksRead).length > 0;

function readNextChunk(plan: DeckPlan, pass: OpenPass, liveIds: ReadonlySet<string>): DeckPlan {
  const pulled = new Set(pass.pulledIds);
  const passIndex = plan.passCount - 1;
  const appended = pass
    .readChunk(pass.chunksRead)
    .filter((entry) => liveIds.has(entry.cardId) && !pulled.has(entry.cardId))
    .map((entry) => ({ ...entry, passIndex }));
  return {
    ...plan,
    entries: appended.length > 0 ? [...plan.entries, ...appended] : plan.entries,
    openPass: { ...pass, chunksRead: pass.chunksRead + 1 },
  };
}

// Crossing into a new pass clears each card's reappearance count — the cap belongs to the
// pass just finished, not to the whole session.
function openNextPass(plan: DeckPlan, source: DeckSource): DeckPlan {
  const pool = buildFeedPool(source.cards, source.prefs, source.today);
  const exclude = plan.entries.slice(-NO_REPEAT_WINDOW).map((entry) => entry.cardId);
  const readChunk = createPassReader(
    pool,
    { seed: computePassSeed(source.baseSeed, plan.passCount), today: source.today, exclude },
    PASS_CHUNK_SIZE,
  );
  const pass: OpenPass = { readChunk, chunksRead: 0, pulledIds: [] };
  const opened: DeckPlan = {
    ...plan,
    passCount: plan.passCount + 1,
    reappears: {},
    openPass: pass,
  };
  return readNextChunk(opened, pass, new Set(pool.map((card) => card.id)));
}

export function planDeck(source: DeckSource): DeckPlan {
  return openNextPass(EMPTY_DECK, source);
}

/**
 * Appends what comes next: the open pass's next chunk while it has one, else a fresh pass. A
 * chunk is filtered against the live pool, so a card that left mid-pass never lands as a gap;
 * one that empties out entirely moves straight on rather than leaving the deck short.
 */
export function extendDeck(plan: DeckPlan, source: DeckSource): DeckPlan {
  const liveIds = new Set(buildFeedPool(source.cards, source.prefs, source.today).map((c) => c.id));
  let extended = plan;
  while (extended.openPass !== null && hasUnreadChunk(extended.openPass)) {
    extended = readNextChunk(extended, extended.openPass, liveIds);
    if (extended.entries.length > plan.entries.length) return extended;
  }
  return openNextPass(extended, source);
}

export function shouldExtendDeck(plan: DeckPlan, currentIndex: number): boolean {
  if (plan.entries.length === 0) return false;
  const threshold =
    plan.openPass !== null && hasUnreadChunk(plan.openPass)
      ? CHUNK_EXTEND_THRESHOLD
      : PASS_EXTEND_THRESHOLD;
  return currentIndex >= plan.entries.length - threshold;
}

/** A failed card still waiting in an unread chunk of the open pass must not come round again there. */
function pullFromOpenPass(plan: DeckPlan, cardId: string): OpenPass | null {
  const pass = plan.openPass;
  if (pass === null || pass.pulledIds.includes(cardId)) return pass;
  return { ...pass, pulledIds: [...pass.pulledIds, cardId] };
}

/**
 * The one sanctioned repeat. A wrong grade pulls the card's next scheduled appearance forward
 * to the designed offset rather than adding a second one, so failing a card can never put it
 * twice inside the no-repeat window.
 */
export function relocateFailedCard(plan: DeckPlan, cardId: string, currentIndex: number): DeckPlan {
  const reappearCount = plan.reappears[cardId] ?? 0;
  if (reappearCount >= FAILED_REAPPEAR_LIMIT) return plan;
  const target = currentIndex + FAILED_REAPPEAR_OFFSET;
  const scheduledAt = plan.entries.findIndex(
    (entry, index) => index > currentIndex && entry.cardId === cardId,
  );
  if (scheduledAt !== -1 && scheduledAt <= target) return plan;
  const entries = [...plan.entries];
  const [moved] = scheduledAt === -1 ? [] : entries.splice(scheduledAt, 1);
  const returning = moved ?? { cardId, passIndex: Math.max(plan.passCount - 1, 0) };
  entries.splice(Math.min(target, entries.length), 0, returning);
  return {
    ...plan,
    entries,
    reappears: { ...plan.reappears, [cardId]: reappearCount + 1 },
    openPass: moved ? plan.openPass : pullFromOpenPass(plan, cardId),
  };
}

/** A card that leaves the pool mid-session would render as an empty slot: drop what is still ahead. */
export function prunePlannedEntries(
  plan: DeckPlan,
  liveIds: Set<string>,
  currentIndex: number,
): DeckPlan {
  const entries = plan.entries.filter(
    (entry, index) => index <= currentIndex || liveIds.has(entry.cardId),
  );
  return entries.length === plan.entries.length ? plan : { ...plan, entries };
}
