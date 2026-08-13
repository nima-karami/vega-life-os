import { type Card, feedStep } from "@vega/shared";
import { useReducedMotion } from "framer-motion";
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router";
import { todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { FeedCardSheet } from "./FeedCardSheet";
import { FeedCardView } from "./FeedCardView";
import { type FeedControlDraft, FeedControlPage } from "./FeedControlPage";
import { FeedFirstRunHero, FeedNothingDue, FeedNothingMatches, FeedRecovery } from "./FeedNotices";
import { hasSeenFeedHint, markFeedHintSeen } from "./feed-hint";
import { buildFeedPool, describeFeedGlyphs } from "./feed-pool";
import { describeRecallInterval, type FeedStepName, nextFeedStep } from "./feed-steps";
import {
  buildFeedQueue,
  computePassSeed,
  isDueLearning,
  isRecapId,
  type QueueEntry,
} from "./queue";
import { RecapCard } from "./RecapCard";

const NO_REPEAT_WINDOW = 20;
const RENDER_RADIUS = 2;
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);
const EVERYTHING: FeedControlDraft = { mode: "mix", types: [], categories: [] };
// The feed is a deliberately focusable scroll region so ArrowUp/Down page it (WCAG 2.1.1);
// a computed tabindex is jsx-a11y's sanctioned "developer-asserted focusable container" path.
const SCROLL_TABINDEX = 0;

// A due card shown or graded (or a card recruited into review) this session must not be
// re-injected by later passes — it re-enters next visit via nextDue. exclude alone can't do
// this: the queue's due lane bypasses excludeSet, so drop such still-due cards from the pool.
function excludeDeferredDue(pool: Card[], deferred: Set<string>, today: string): Card[] {
  return pool.filter((card) => !(isDueLearning(card, today) && deferred.has(card.id)));
}

function getRecentCardIds(entries: QueueEntry[], limit: number): string[] {
  return entries
    .filter((entry) => !isRecapId(entry.cardId))
    .slice(-limit)
    .map((entry) => entry.cardId);
}

function findPreviousRecapIndex(entries: QueueEntry[], before: number): number {
  for (let i = before - 1; i >= 0; i--) {
    if (isRecapId(entries[i].cardId)) return i;
  }
  return -1;
}

export function ScrollPage() {
  const navigate = useNavigate();
  const cards = useStore((s) => s.cards);
  const cardPrefs = useStore((s) => s.cardPrefs);
  const loadFailed = useStore((s) => s.loadFailed);
  const bootstrap = useStore((s) => s.bootstrap);
  const hideCard = useStore((s) => s.hideCard);
  const toggleCardLike = useStore((s) => s.toggleCardLike);
  const setCardLearning = useStore((s) => s.setCardLearning);
  const promoteCard = useStore((s) => s.promoteCard);
  const gradeCard = useStore((s) => s.gradeCard);
  const setCardPrefs = useStore((s) => s.setCardPrefs);
  const pushToast = useStore((s) => s.pushToast);
  const shouldReduceMotion = useReducedMotion();

  const today = todayISO();
  const pool = useMemo(() => buildFeedPool(cards, cardPrefs, today), [cards, cardPrefs, today]);
  const poolById = useMemo(() => new Map(pool.map((card) => [card.id, card])), [pool]);
  const learningCount = useMemo(() => pool.filter((card) => card.box !== null).length, [pool]);
  const glyphs = useMemo(() => describeFeedGlyphs(cards, cardPrefs), [cards, cardPrefs]);

  const [baseSeed] = useState(() => Date.now() & 0xffff);
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [currentIndex, setCurrentIndexState] = useState(0);
  const [progress, setProgress] = useState<{ cardId: string; step: FeedStepName } | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [sheetCardId, setSheetCardId] = useState<string | null>(null);
  const [isControlOpen, setIsControlOpen] = useState(false);
  const [showsHint, setShowsHint] = useState(() => !hasSeenFeedHint());

  const scrollRef = useRef<HTMLElement>(null);
  const currentIndexRef = useRef(0);
  const passCountRef = useRef(0);
  const initializedRef = useRef(false);
  const queueEntriesRef = useRef<QueueEntry[]>([]);
  const announceNonceRef = useRef(0);
  const deferredDueRef = useRef(new Set<string>());

  useEffect(() => {
    queueEntriesRef.current = queueEntries;
  }, [queueEntries]);

  // A trailing zero-width space that flips each call so screen readers re-announce
  // an identical consecutive message (two Hides in a row).
  const announce = (message: string) => {
    announceNonceRef.current += 1;
    setAnnouncement(message + ZERO_WIDTH_SPACE.repeat(announceNonceRef.current % 2));
  };

  const keySeqRef = useRef(0);
  const keyMapRef = useRef(new WeakMap<QueueEntry, string>());
  const keyFor = (entry: QueueEntry): string => {
    const existing = keyMapRef.current.get(entry);
    if (existing) return existing;
    const next = `e${keySeqRef.current++}`;
    keyMapRef.current.set(entry, next);
    return next;
  };

  // Advancing to a new entry drops any progress — a re-shown card starts on its face.
  const setCurrentIndex = useCallback((index: number) => {
    if (currentIndexRef.current === index) return;
    currentIndexRef.current = index;
    setCurrentIndexState(index);
    setProgress(null);
  }, []);

  // Build the next pass off the frozen prefix (exclude its last-20) and append it.
  const appendPass = useCallback(
    (prefix: QueueEntry[]) => {
      const tail = buildFeedQueue(excludeDeferredDue(pool, deferredDueRef.current, today), {
        seed: computePassSeed(baseSeed, passCountRef.current),
        today,
        exclude: getRecentCardIds(prefix, NO_REPEAT_WINDOW),
      });
      passCountRef.current += 1;
      setQueueEntries([...prefix, ...tail]);
    },
    [pool, baseSeed, today],
  );

  // Build the first pass, and on any pool change rebuild only the unplayed tail —
  // the seen prefix + current entry stay frozen. All impurity (ref reads/writes, queue
  // build) stays in the effect body; setState gets a value.
  useEffect(() => {
    if (pool.length === 0) {
      initializedRef.current = false;
      passCountRef.current = 0;
      setQueueEntries([]);
      return;
    }
    const prev = queueEntriesRef.current;
    if (!initializedRef.current || prev.length === 0) {
      initializedRef.current = true;
      passCountRef.current = 1;
      setQueueEntries(
        buildFeedQueue(excludeDeferredDue(pool, deferredDueRef.current, today), {
          seed: computePassSeed(baseSeed, 0),
          today,
        }),
      );
      return;
    }
    const freezeUpTo = Math.min(currentIndexRef.current, prev.length - 1);
    appendPass(prev.slice(0, freezeUpTo + 1));
  }, [pool, baseSeed, today, appendPass]);

  // Scrolling onto the trailing recap chains the next pass, excluding the last-20 shown.
  useEffect(() => {
    const entry = queueEntries[currentIndex];
    if (!entry || pool.length === 0) return;
    if (isRecapId(entry.cardId) && currentIndex === queueEntries.length - 1) {
      appendPass(queueEntries);
    }
  }, [currentIndex, queueEntries, pool, appendPass]);

  // Track the current entry via the sections crossing the viewport centre; re-runs
  // when the queue grows so freshly-appended sections get observed too.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller || queueEntries.length === 0) return;
    const observer = new IntersectionObserver(
      (records) => {
        for (const record of records) {
          if (record.isIntersecting && record.intersectionRatio >= 0.6) {
            setCurrentIndex(Number((record.target as HTMLElement).dataset.index));
          }
        }
      },
      { root: scroller, threshold: [0.6] },
    );
    for (const section of scroller.querySelectorAll("[data-index]")) observer.observe(section);
    return () => observer.disconnect();
  }, [queueEntries, setCurrentIndex]);

  // A due card that reaches the viewport is spent for this session (graded or scrolled past);
  // record it so later passes defer it.
  useEffect(() => {
    const entry = queueEntries[currentIndex];
    if (!entry || isRecapId(entry.cardId)) return;
    const card = poolById.get(entry.cardId);
    if (card && isDueLearning(card, today)) deferredDueRef.current.add(card.id);
  }, [currentIndex, queueEntries, poolById, today]);

  const advance = () => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const sections = scroller.querySelectorAll<HTMLElement>("[data-index]");
    sections[currentIndexRef.current + 1]?.scrollIntoView({
      behavior: shouldReduceMotion ? "auto" : "smooth",
    });
  };

  const stepOf = (card: Card): FeedStepName =>
    progress !== null && progress.cardId === card.id ? progress.step : "face";

  const advanceStep = (card: Card) => {
    const next = nextFeedStep(feedStep(card), stepOf(card));
    if (next === null) return;
    setProgress({ cardId: card.id, step: next });
    announce(next === "reveal" ? "Revealed" : "Did that come back to you?");
  };

  const dismissHint = () => {
    markFeedHintSeen();
    setShowsHint(false);
  };

  const handleHide = (card: Card) => {
    hideCard(card.id);
    announce("Hidden");
    pushToast("Hidden");
    setProgress(null);
    advance();
  };

  const handleToggleLearning = (card: Card) => {
    const next = card.box === null;
    setCardLearning(card.id, next);
    // Recruiting sets nextDue=today, so the rebuild would due-inject it this session — defer it.
    if (next) deferredDueRef.current.add(card.id);
    announce(next ? "On review" : "Off review");
  };

  const handleToggleLike = (card: Card) => {
    toggleCardLike(card.id);
    announce(card.likedAt === null ? "Kept" : "No longer kept");
  };

  const handleGrade = (card: Card, correct: boolean) => {
    if (card.box === null) return;
    gradeCard(card.id, correct);
    announce(
      `${correct ? "Yes" : "Not quite"} — ${describeRecallInterval(card.box, correct, today)}`,
    );
    setProgress(null);
    advance();
  };

  const handleFeedKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const entry = queueEntries[currentIndexRef.current];
    if (!entry || isRecapId(entry.cardId)) return;
    const card = poolById.get(entry.cardId);
    if (!card) return;
    if (event.key === "Enter") {
      advanceStep(card);
      return;
    }
    if (stepOf(card) !== "recall") return;
    if (event.key === "1") handleGrade(card, true);
    else if (event.key === "2") handleGrade(card, false);
  };

  const renderEntry = (entry: QueueEntry, index: number) => {
    if (isRecapId(entry.cardId)) {
      const prevRecap = findPreviousRecapIndex(queueEntries, index);
      return (
        <RecapCard
          seenThisPass={index - prevRecap - 1}
          totalInRotation={pool.length}
          learningCount={learningCount}
          onNewCard={() => navigate("/cards/new")}
        />
      );
    }
    const card = poolById.get(entry.cardId);
    if (!card) return null;
    return (
      <FeedCardView
        card={card}
        step={stepOf(card)}
        glyphs={glyphs}
        showsHint={showsHint && index === 0}
        today={today}
        onAdvance={() => advanceStep(card)}
        onOpenControl={() => setIsControlOpen(true)}
        onOpenSheet={() => setSheetCardId(card.id)}
        onDismissHint={dismissHint}
        onToggleLike={() => handleToggleLike(card)}
        onToggleLearning={() => handleToggleLearning(card)}
        onGrade={(correct) => handleGrade(card, correct)}
      />
    );
  };

  const sheetCard = sheetCardId === null ? null : (poolById.get(sheetCardId) ?? null);

  if (loadFailed) return <FeedRecovery onRetry={() => void bootstrap()} />;
  if (pool.length === 0) {
    if (cards.length === 0)
      return (
        <FeedFirstRunHero
          onAddCard={() => navigate("/cards/new")}
          onOpenManager={() => navigate("/cards")}
        />
      );
    if (cardPrefs.mode === "due")
      return <FeedNothingDue onSwitchToMix={() => setCardPrefs({ mode: "mix" })} />;
    return <FeedNothingMatches onReset={() => setCardPrefs(EVERYTHING)} />;
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      <section
        ref={scrollRef}
        aria-label="Card feed"
        tabIndex={SCROLL_TABINDEX}
        onKeyDown={handleFeedKeyDown}
        className="mx-auto flex h-full max-w-3xl snap-y snap-mandatory flex-col overflow-y-auto overflow-x-hidden overscroll-contain pb-2 outline-none"
      >
        {queueEntries.map((entry, index) => (
          <div key={keyFor(entry)} data-index={index} className="h-full w-full shrink-0 snap-start">
            {Math.abs(index - currentIndex) <= RENDER_RADIUS ? renderEntry(entry, index) : null}
          </div>
        ))}
      </section>

      <span data-feed-announcer className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>

      {sheetCard !== null && (
        <FeedCardSheet
          card={sheetCard}
          onClose={() => setSheetCardId(null)}
          onPromote={() => promoteCard(sheetCard.id)}
          onToggleLike={() => handleToggleLike(sheetCard)}
          onHide={() => handleHide(sheetCard)}
        />
      )}

      {isControlOpen && (
        <FeedControlPage
          cards={cards}
          prefs={cardPrefs}
          today={today}
          onApply={(draft) => {
            setCardPrefs(draft);
            setIsControlOpen(false);
          }}
          onClose={() => setIsControlOpen(false)}
        />
      )}
    </div>
  );
}
