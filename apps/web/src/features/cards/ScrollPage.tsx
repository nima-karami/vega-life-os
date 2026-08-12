import { Button } from "@heroui/react";
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
import { Icon } from "@/core/ui";
import { CardEditorModal } from "./CardEditorModal";
import { FeedCardView } from "./FeedCardView";
import { buildFeedPool, type FeedCard } from "./feed-cards";
import { stepLeitner } from "./leitner";
import { parseVocabCardId } from "./model";
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
// The feed is a deliberately focusable scroll region so ArrowUp/Down page it (WCAG 2.1.1);
// a computed tabindex is jsx-a11y's sanctioned "developer-asserted focusable container" path.
const SCROLL_TABINDEX = 0;

// A due card shown or graded (or a card recruited into learning) this session must not be
// re-injected by later passes — it re-enters next visit via nextDue. exclude alone can't do
// this: the queue's due lane bypasses excludeSet, so drop such still-due cards from the pool.
function excludeDeferredDue(pool: FeedCard[], deferred: Set<string>): FeedCard[] {
  return pool.filter((card) => !(isDueLearning(card) && deferred.has(card.id)));
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
  const mindCards = useStore((s) => s.mindCards);
  const mindMeta = useStore((s) => s.mindMeta);
  const vocab = useStore((s) => s.vocab);
  const hideMindCard = useStore((s) => s.hideMindCard);
  const setMindCardLearning = useStore((s) => s.setMindCardLearning);
  const toggleMindCardLike = useStore((s) => s.toggleMindCardLike);
  const gradeMindCard = useStore((s) => s.gradeMindCard);
  const reviewVocab = useStore((s) => s.reviewVocab);
  const pushToast = useStore((s) => s.pushToast);
  const shouldReduceMotion = useReducedMotion();

  const today = todayISO();
  const pool = useMemo(
    () => buildFeedPool({ mindCards, mindMeta, vocab }, today),
    [mindCards, mindMeta, vocab, today],
  );
  const poolById = useMemo(() => new Map(pool.map((card) => [card.id, card])), [pool]);
  const learningCount = useMemo(() => pool.filter((card) => card.learning).length, [pool]);

  const [baseSeed] = useState(() => Date.now() & 0xffff);
  const [queueEntries, setQueueEntries] = useState<QueueEntry[]>([]);
  const [currentIndex, setCurrentIndexState] = useState(0);
  const [flippedId, setFlippedId] = useState<string | null>(null);
  const [announcement, setAnnouncement] = useState("");
  const [editorCardId, setEditorCardId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

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

  // Advancing to a new entry also drops any flip — re-shown cards start front-side.
  const setCurrentIndex = useCallback((index: number) => {
    if (currentIndexRef.current === index) return;
    currentIndexRef.current = index;
    setCurrentIndexState(index);
    setFlippedId(null);
  }, []);

  const openEditor = (cardId: string | null) => {
    setEditorCardId(cardId);
    setIsEditorOpen(true);
  };

  // Build the next pass off the frozen prefix (exclude its last-20) and append it.
  const appendPass = useCallback(
    (prefix: QueueEntry[]) => {
      const tail = buildFeedQueue(excludeDeferredDue(pool, deferredDueRef.current), {
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
  // the seen prefix + current entry stay frozen (spec §2.3 lifecycle). All impurity
  // (ref reads/writes, queue build) stays in the effect body; setState gets a value.
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
        buildFeedQueue(excludeDeferredDue(pool, deferredDueRef.current), {
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
  // record it so later passes defer it (excludeDeferredDue).
  useEffect(() => {
    const entry = queueEntries[currentIndex];
    if (!entry || isRecapId(entry.cardId)) return;
    const card = poolById.get(entry.cardId);
    if (card && isDueLearning(card)) deferredDueRef.current.add(card.id);
  }, [currentIndex, queueEntries, poolById]);

  const advance = () => {
    const scroller = scrollRef.current;
    if (!scroller) return;
    const sections = scroller.querySelectorAll<HTMLElement>("[data-index]");
    sections[currentIndexRef.current + 1]?.scrollIntoView({
      behavior: shouldReduceMotion ? "auto" : "smooth",
    });
  };

  const handleHide = (card: FeedCard) => {
    hideMindCard(card.id);
    announce("Hidden");
    pushToast("Hidden");
    setFlippedId(null);
    advance();
  };

  const handleToggleLearning = (card: FeedCard) => {
    const next = !card.learning;
    setMindCardLearning(card.id, next);
    // Recruiting sets nextDue=today, so the rebuild would due-inject it this session — defer it.
    if (next) deferredDueRef.current.add(card.id);
    announce(next ? "Learning on" : "Learning off");
  };

  const handleToggleLike = (card: FeedCard) => {
    toggleMindCardLike(card.id);
    announce(card.liked ? "Like removed" : "Liked");
  };

  const handleFeedKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== "Enter") return;
    const entry = queueEntries[currentIndexRef.current];
    if (!entry || isRecapId(entry.cardId)) return;
    const card = poolById.get(entry.cardId);
    if (!card || !card.flippable || card.body === "") return;
    setFlippedId((current) => (current === card.id ? null : card.id));
  };

  const handleGrade = (card: FeedCard, correct: boolean) => {
    if (card.box === null) return;
    const nextBox = stepLeitner(card.box, correct, today).box;
    if (card.kind === "vocab") reviewVocab(parseVocabCardId(card.id), correct);
    else gradeMindCard(card.id, correct);
    announce(correct ? `Got it — box ${nextBox}` : "Again — back to box 1");
    setFlippedId(null);
    advance();
  };

  const renderEntry = (entry: QueueEntry, index: number) => {
    if (isRecapId(entry.cardId)) {
      const prevRecap = findPreviousRecapIndex(queueEntries, index);
      return (
        <RecapCard
          seenThisPass={index - prevRecap - 1}
          totalInRotation={pool.length}
          learningCount={learningCount}
          onNewCard={() => openEditor(null)}
        />
      );
    }
    const card = poolById.get(entry.cardId);
    if (!card) return null;
    return (
      <FeedCardView
        card={card}
        reversed={entry.reversed}
        variant={entry.variant}
        flipped={flippedId === card.id}
        onFlip={() => setFlippedId((current) => (current === card.id ? null : card.id))}
        onToggleLike={() => handleToggleLike(card)}
        onToggleLearning={() => handleToggleLearning(card)}
        onHide={() => handleHide(card)}
        onEdit={() => openEditor(card.id)}
        onManage={() => navigate("/scroll/manage")}
        onGrade={(correct) => handleGrade(card, correct)}
      />
    );
  };

  return (
    <div className="relative h-full w-full overflow-hidden">
      {pool.length === 0 ? (
        <FirstRunHero
          onAddCard={() => openEditor(null)}
          onOpenManager={() => navigate("/scroll/manage")}
        />
      ) : (
        <>
          <section
            ref={scrollRef}
            aria-label="Card feed"
            tabIndex={SCROLL_TABINDEX}
            onKeyDown={handleFeedKeyDown}
            className="mx-auto flex h-full max-w-3xl snap-y snap-mandatory flex-col overflow-y-auto overflow-x-hidden overscroll-contain pb-2 outline-none"
          >
            {queueEntries.map((entry, index) => (
              <div
                key={keyFor(entry)}
                data-index={index}
                className="h-full w-full shrink-0 snap-start"
              >
                {Math.abs(index - currentIndex) <= RENDER_RADIUS ? renderEntry(entry, index) : null}
              </div>
            ))}
          </section>

          <div className="absolute right-3 top-3 z-20 flex gap-2">
            <ChromeButton label="Add card" icon="plus" onClick={() => openEditor(null)} />
            <ChromeButton
              label="Manage cards"
              icon="sliders"
              onClick={() => navigate("/scroll/manage")}
            />
          </div>
        </>
      )}

      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>

      <CardEditorModal
        cardId={editorCardId}
        isOpen={isEditorOpen}
        onClose={() => setIsEditorOpen(false)}
      />
    </div>
  );
}

function ChromeButton({
  label,
  icon,
  onClick,
}: {
  label: string;
  icon: "plus" | "sliders";
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="grid h-11 w-11 place-items-center rounded-full border border-border bg-surface/80 text-muted outline-none backdrop-blur transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
    >
      <Icon name={icon} size={18} />
    </button>
  );
}

function FirstRunHero({
  onAddCard,
  onOpenManager,
}: {
  onAddCard: () => void;
  onOpenManager: () => void;
}) {
  return (
    <div className="flex h-full w-full items-center justify-center px-6">
      <div className="mx-auto max-w-md text-center">
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          Program your own scroll
        </h1>
        <p className="mt-3 text-sm text-muted">
          Build a feed of ideas worth revisiting — heuristics, facts, tactics, vocabulary. Scroll
          that instead of the algorithm.
        </p>
        <div className="mt-6 flex flex-col items-center gap-3">
          <Button variant="primary" onPress={onAddCard}>
            <Icon name="plus" size={15} />
            Add your first card
          </Button>
          <button
            type="button"
            onClick={onOpenManager}
            className="text-sm text-muted underline underline-offset-4 outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
          >
            Open the manager
          </button>
        </div>
      </div>
    </div>
  );
}
