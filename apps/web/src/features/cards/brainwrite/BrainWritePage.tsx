import { Button } from "@heroui/react";
import type { Card } from "@vega/shared";
import { AnimatePresence, useReducedMotion } from "framer-motion";
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
import { FeedCardSheet, isCardSheetMounted } from "../FeedCardSheet";
import { type FeedControlDraft, FeedControlPage } from "../FeedControlPage";
import { FeedRecovery } from "../FeedNotices";
import { buildFeedPool } from "../feed-pool";
import { computePassSeed, FAILED_REAPPEAR_LIMIT, FAILED_REAPPEAR_OFFSET } from "../queue";
import { BrainWriteCardView, type BrainWriteCardViewHandle } from "./BrainWriteCardView";
import { buildBrainWriteQueue, type DeckEntry } from "./brainwrite-deck";

const NO_REPEAT_WINDOW = 20;
const RENDER_RADIUS = 2;
// The deck has no trailing recap to chain off, so nearing the end is the extend trigger.
const PASS_EXTEND_THRESHOLD = 2;
const ZERO_WIDTH_SPACE = String.fromCharCode(0x200b);
const SCROLL_TABINDEX = 0;
const EVERYTHING: FeedControlDraft = { mode: "mix", types: [], categories: [] };

function BrainWriteNotice({
  title,
  body,
  cta,
}: {
  title: string;
  body: string;
  cta: { label: string; onPress: () => void };
}) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-4 px-8 text-center">
      <h1 className="font-semibold text-2xl text-foreground tracking-tight">{title}</h1>
      <p className="max-w-sm text-muted text-sm">{body}</p>
      <Button variant="primary" onPress={cta.onPress}>
        {cta.label}
      </Button>
    </div>
  );
}

export function BrainWritePage() {
  const navigate = useNavigate();
  const cards = useStore((s) => s.cards);
  const cardPrefs = useStore((s) => s.cardPrefs);
  const loadFailed = useStore((s) => s.loadFailed);
  const bootstrap = useStore((s) => s.bootstrap);
  const hideCard = useStore((s) => s.hideCard);
  const toggleCardLike = useStore((s) => s.toggleCardLike);
  const promoteCard = useStore((s) => s.promoteCard);
  const gradeCard = useStore((s) => s.gradeCard);
  const setCardPrefs = useStore((s) => s.setCardPrefs);
  const pushToast = useStore((s) => s.pushToast);
  const shouldReduceMotion = useReducedMotion();

  const today = todayISO();
  const pool = useMemo(() => buildFeedPool(cards, cardPrefs, today), [cards, cardPrefs, today]);
  const poolById = useMemo(() => new Map(pool.map((card) => [card.id, card])), [pool]);

  const [baseSeed] = useState(() => Date.now() & 0xffff);
  const [queueEntries, setQueueEntries] = useState<DeckEntry[]>([]);
  const [currentIndex, setCurrentIndexState] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [sheetCardId, setSheetCardId] = useState<string | null>(null);
  const [isControlOpen, setIsControlOpen] = useState(false);

  const scrollRef = useRef<HTMLElement>(null);
  const activeCardRef = useRef<BrainWriteCardViewHandle>(null);
  const currentIndexRef = useRef(0);
  const passCountRef = useRef(0);
  const initializedRef = useRef(false);
  const queueEntriesRef = useRef<DeckEntry[]>([]);
  const announceNonceRef = useRef(0);
  const reappearCountRef = useRef(new Map<string, number>());
  const pendingReinsertRef = useRef<{ cardId: string; offset: number } | null>(null);
  const isGestureLiveRef = useRef(false);
  const pendingRebuildRef = useRef<{ rebuild: (() => void) | null; extend: (() => void) | null }>({
    rebuild: null,
    extend: null,
  });

  useEffect(() => {
    queueEntriesRef.current = queueEntries;
  }, [queueEntries]);

  // A trailing zero-width space that flips each call so screen readers re-announce
  // an identical consecutive message (two bounces in a row).
  const announce = useCallback((message: string) => {
    announceNonceRef.current += 1;
    setAnnouncement(message + ZERO_WIDTH_SPACE.repeat(announceNonceRef.current % 2));
  }, []);

  // Keyed by card, pass and occurrence rather than object identity: a rebuilt tail
  // reuses the same keys, so nothing remounts under a finger that is still down.
  const entryKeys = useMemo(() => {
    const seen = new Map<string, number>();
    return queueEntries.map((entry) => {
      const base = `${entry.cardId}#p${entry.passIndex}`;
      const occurrence = seen.get(base) ?? 0;
      seen.set(base, occurrence + 1);
      return `${base}#o${occurrence}`;
    });
  }, [queueEntries]);

  // "Live" spans the fly-off and the recentre too, not just the drag — the pass-extend
  // rebuild fires during settling by construction.
  const handleGestureStart = useCallback(() => {
    isGestureLiveRef.current = true;
  }, []);

  // A rebuild subsumes an extend — both append a fresh pass — so a deferred pair collapses
  // to the stronger one, run against the pool as it stood when the gesture ended.
  const handleGestureEnd = useCallback(() => {
    isGestureLiveRef.current = false;
    const pending = pendingRebuildRef.current;
    const run = pending.rebuild ?? pending.extend;
    pending.rebuild = null;
    pending.extend = null;
    run?.();
  }, []);

  const runOrDefer = useCallback((kind: "rebuild" | "extend", run: () => void) => {
    if (!isGestureLiveRef.current) {
      run();
      return;
    }
    pendingRebuildRef.current[kind] = run;
  }, []);

  const setCurrentIndex = useCallback((index: number) => {
    if (currentIndexRef.current === index) return;
    currentIndexRef.current = index;
    setCurrentIndexState(index);
  }, []);

  const buildPass = useCallback(
    (
      passIndex: number,
      options: { exclude?: string[]; reinsert?: { cardId: string; offset: number } | null } = {},
    ): DeckEntry[] =>
      buildBrainWriteQueue(cards, cardPrefs, today, {
        seed: computePassSeed(baseSeed, passIndex),
        exclude: options.exclude,
        reinsert: options.reinsert,
      }).map((entry) => ({ ...entry, passIndex })),
    [cards, cardPrefs, today, baseSeed],
  );

  // Freeze what's been seen, rebuild only the tail — a wrong-graded card queued for
  // forced reappearance rides along on the same rebuild.
  const appendPass = useCallback(
    (prefix: DeckEntry[]) => {
      const reinsert = pendingReinsertRef.current;
      pendingReinsertRef.current = null;
      const passIndex = passCountRef.current;
      passCountRef.current = passIndex + 1;
      const tail = buildPass(passIndex, {
        exclude: prefix.slice(-NO_REPEAT_WINDOW).map((entry) => entry.cardId),
        reinsert,
      });
      setQueueEntries([...prefix, ...tail]);
    },
    [buildPass],
  );

  const rebuildQueue = useCallback(() => {
    if (pool.length === 0) {
      initializedRef.current = false;
      passCountRef.current = 0;
      reappearCountRef.current.clear();
      setQueueEntries([]);
      return;
    }
    const prev = queueEntriesRef.current;
    if (!initializedRef.current || prev.length === 0) {
      initializedRef.current = true;
      passCountRef.current = 1;
      reappearCountRef.current.clear();
      setQueueEntries(buildPass(0));
      return;
    }
    appendPass(prev.slice(0, Math.min(currentIndexRef.current, prev.length - 1) + 1));
  }, [pool, buildPass, appendPass]);

  // Nearing the end chains the next pass. Crossing into it resets each card's reappearance
  // count — the 3-per-pass cap applies to the pass just finished, not the whole session.
  const extendQueue = useCallback(() => {
    if (queueEntries.length === 0 || pool.length === 0) return;
    if (currentIndex < queueEntries.length - PASS_EXTEND_THRESHOLD) return;
    reappearCountRef.current.clear();
    appendPass(queueEntries);
  }, [currentIndex, queueEntries, pool, appendPass]);

  useEffect(() => {
    runOrDefer("rebuild", rebuildQueue);
  }, [rebuildQueue, runOrDefer]);

  useEffect(() => {
    runOrDefer("extend", extendQueue);
  }, [extendQueue, runOrDefer]);

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

  const advance = useCallback(() => {
    const sections = scrollRef.current?.querySelectorAll<HTMLElement>("[data-index]");
    sections?.[currentIndexRef.current + 1]?.scrollIntoView({
      behavior: shouldReduceMotion ? "auto" : "smooth",
    });
  }, [shouldReduceMotion]);

  const handleToggleLike = (card: Card) => {
    toggleCardLike(card.id);
    announce(card.likedAt === null ? "Kept" : "No longer kept");
  };

  const handleHide = (card: Card) => {
    hideCard(card.id);
    announce("Hidden");
    pushToast("Hidden");
    advance();
  };

  const handleGrade = (card: Card, correct: boolean) => {
    gradeCard(card.id, correct);
    if (correct) return;
    const reappearCount = reappearCountRef.current.get(card.id) ?? 0;
    if (reappearCount >= FAILED_REAPPEAR_LIMIT) return;
    reappearCountRef.current.set(card.id, reappearCount + 1);
    pendingReinsertRef.current = { cardId: card.id, offset: FAILED_REAPPEAR_OFFSET };
  };

  // ArrowUp/Down need no handler — the focused snap scroller pages on them natively.
  const handleBrainWriteKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (isCardSheetMounted()) return;
    if (event.key === "Enter") activeCardRef.current?.flip();
    else if (event.key === "1") activeCardRef.current?.commitKeyboardGrade(true);
    else if (event.key === "2") activeCardRef.current?.commitKeyboardGrade(false);
  };

  const renderEntry = (entry: DeckEntry, index: number) => {
    const card = poolById.get(entry.cardId);
    if (!card) return null;
    const isActiveCard = index === currentIndex;
    return (
      <BrainWriteCardView
        ref={isActiveCard ? activeCardRef : undefined}
        card={card}
        today={today}
        isActiveCard={isActiveCard}
        onAdvance={advance}
        onOpenSheet={() => setSheetCardId(card.id)}
        onGrade={(correct) => handleGrade(card, correct)}
        onAnnounce={announce}
        onGestureStart={handleGestureStart}
        onGestureEnd={handleGestureEnd}
      />
    );
  };

  const sheetCard = sheetCardId === null ? null : (poolById.get(sheetCardId) ?? null);

  if (loadFailed) return <FeedRecovery onRetry={() => void bootstrap()} />;
  if (pool.length === 0) {
    if (cards.length === 0) {
      return (
        <BrainWriteNotice
          title="Nothing to review yet"
          body="Add a card and put it into review to start a BrainWrite session."
          cta={{ label: "Add a card", onPress: () => navigate("/cards/new") }}
        />
      );
    }
    return (
      <BrainWriteNotice
        title="Nothing to review right now"
        body="Your cards are all still here — what you've asked the deck to show is narrowing it to nothing."
        cta={{ label: "Show everything", onPress: () => setCardPrefs(EVERYTHING) }}
      />
    );
  }

  return (
    <div className="relative h-full w-full overflow-hidden">
      {/* data-feed-scroll is what FeedCardSheet's scroll-key guard looks for — without it
          arrows would page the deck behind an open sheet. */}
      <section
        ref={scrollRef}
        data-brainwrite-scroll
        data-feed-scroll
        aria-label="BrainWrite deck"
        tabIndex={SCROLL_TABINDEX}
        onKeyDown={handleBrainWriteKeyDown}
        className="mx-auto flex h-full max-w-3xl snap-y snap-mandatory flex-col overflow-y-auto overflow-x-hidden overscroll-contain outline-none sm:pb-2"
      >
        {queueEntries.map((entry, index) => (
          <div
            key={entryKeys[index]}
            data-index={index}
            className="h-full w-full shrink-0 snap-start"
          >
            {Math.abs(index - currentIndex) <= RENDER_RADIUS ? renderEntry(entry, index) : null}
          </div>
        ))}
      </section>

      <span data-brainwrite-announcer className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>

      <AnimatePresence mode="wait">
        {sheetCard !== null && (
          <FeedCardSheet
            card={sheetCard}
            onClose={() => setSheetCardId(null)}
            onPromote={() => promoteCard(sheetCard.id)}
            onToggleLike={() => handleToggleLike(sheetCard)}
            onHide={() => handleHide(sheetCard)}
            onOpenControl={() => setIsControlOpen(true)}
          />
        )}
      </AnimatePresence>

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
