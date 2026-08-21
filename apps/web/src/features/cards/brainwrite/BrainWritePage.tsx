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
import { BrainWriteCardView, type BrainWriteCardViewHandle } from "./BrainWriteCardView";
import {
  type DeckEntry,
  type DeckPlan,
  type DeckSource,
  EMPTY_DECK,
  extendDeck,
  planDeck,
  prunePlannedEntries,
  relocateFailedCard,
} from "./brainwrite-deck";

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
  const [deck, setDeck] = useState<DeckPlan>(EMPTY_DECK);
  const [currentIndex, setCurrentIndexState] = useState(0);
  const [announcement, setAnnouncement] = useState("");
  const [sheetCardId, setSheetCardId] = useState<string | null>(null);
  const [isControlOpen, setIsControlOpen] = useState(false);

  const queueEntries = deck.entries;
  const scrollRef = useRef<HTMLElement>(null);
  const activeCardRef = useRef<BrainWriteCardViewHandle>(null);
  const currentIndexRef = useRef(0);
  const announceNonceRef = useRef(0);
  const isGestureLiveRef = useRef(false);
  const isExtendPendingRef = useRef(false);
  const deckSourceRef = useRef<DeckSource>({ cards, prefs: cardPrefs, today, baseSeed });
  const plannedKeyRef = useRef("");

  useEffect(() => {
    deckSourceRef.current = { cards, prefs: cardPrefs, today, baseSeed };
  });

  // A trailing zero-width space that flips each call so screen readers re-announce
  // an identical consecutive message (two bounces in a row).
  const announce = useCallback((message: string) => {
    announceNonceRef.current += 1;
    setAnnouncement(message + ZERO_WIDTH_SPACE.repeat(announceNonceRef.current % 2));
  }, []);

  // Keyed by card, pass and occurrence rather than object identity, so appending a pass or
  // relocating a failed card remounts nothing under a finger that is still down.
  const entryKeys = useMemo(() => {
    const seen = new Map<string, number>();
    return queueEntries.map((entry) => {
      const base = `${entry.cardId}#p${entry.passIndex}`;
      const occurrence = seen.get(base) ?? 0;
      seen.set(base, occurrence + 1);
      return `${base}#o${occurrence}`;
    });
  }, [queueEntries]);

  const setCurrentIndex = useCallback((index: number) => {
    if (currentIndexRef.current === index) return;
    currentIndexRef.current = index;
    setCurrentIndexState(index);
  }, []);

  // Nearing the end chains the next pass. Nothing already planned is touched, so a grade
  // never reaches back into the sequence the user is walking through.
  const extendIfShort = useCallback(() => {
    setDeck((plan) => {
      if (plan.entries.length === 0) return plan;
      if (currentIndexRef.current < plan.entries.length - PASS_EXTEND_THRESHOLD) return plan;
      return extendDeck(plan, deckSourceRef.current);
    });
  }, []);

  const handleGestureStart = useCallback(() => {
    isGestureLiveRef.current = true;
  }, []);

  // Chaining a pass grows the scroller, so it waits for the finger to leave.
  const handleGestureEnd = useCallback(() => {
    isGestureLiveRef.current = false;
    if (!isExtendPendingRef.current) return;
    isExtendPendingRef.current = false;
    extendIfShort();
  }, [extendIfShort]);

  // The pool's *shape*, not the cards array: re-planning belongs to a prefs change or a day
  // rollover. A grade or a background refetch must leave the planned session alone.
  const planKey = `${today}|${cardPrefs.mode}|${cardPrefs.types.join()}|${cardPrefs.categories.join()}`;

  // The pool arrives a tick after mount on a cold load, so an empty deck over a live pool is
  // the other thing that means "nothing has been planned yet".
  useEffect(() => {
    const isKeyStale = plannedKeyRef.current !== planKey;
    if (!isKeyStale && (deck.entries.length > 0 || pool.length === 0)) return;
    plannedKeyRef.current = planKey;
    setCurrentIndex(0);
    if (isKeyStale) scrollRef.current?.scrollTo({ top: 0 });
    setDeck(planDeck(deckSourceRef.current));
  });

  useEffect(() => {
    const liveIds = new Set(pool.map((card) => card.id));
    setDeck((plan) => prunePlannedEntries(plan, liveIds, currentIndexRef.current));
  }, [pool]);

  useEffect(() => {
    if (queueEntries.length === 0) return;
    if (currentIndex < queueEntries.length - PASS_EXTEND_THRESHOLD) return;
    if (isGestureLiveRef.current) {
      isExtendPendingRef.current = true;
      return;
    }
    extendIfShort();
  }, [currentIndex, queueEntries.length, extendIfShort]);

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

  // Runs on release, before the advance scroll — so the index is still the graded card's.
  const handleGrade = (card: Card, correct: boolean) => {
    gradeCard(card.id, correct);
    if (correct) return;
    setDeck((plan) => relocateFailedCard(plan, card.id, currentIndexRef.current));
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
