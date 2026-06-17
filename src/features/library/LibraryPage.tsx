import { useState } from "react";
import { fmtShort, todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { Button, cx, Icon, Label, Panel, ProgressBar, Stars, Tag } from "@/core/ui";
import { BookDrawer } from "./components/BookDrawer";
import type { Book, BookStatus, Movie } from "./model";

type LibTab = "books" | "film" | "vocab";
const TABS: { id: LibTab; label: string; icon: Parameters<typeof Icon>[0]["name"] }[] = [
  { id: "books", label: "Books", icon: "book" },
  { id: "film", label: "Film", icon: "film" },
  { id: "vocab", label: "Vocabulary", icon: "languages" },
];

export function LibraryPage() {
  const [tab, setTab] = useState<LibTab>("books");
  return (
    <div className="mx-auto max-w-[1200px] p-4">
      <Panel className="mb-4 px-5 py-4">
        <Label>// library</Label>
        <h1 className="display mt-1 text-3xl">Your collections</h1>
        <p className="mono mt-1 text-[11px] text-stone">
          What you read, watch, and learn — the inputs that shape you.
        </p>
        <div className="mt-4 flex gap-2">
          {TABS.map((t) => (
            <button
              type="button"
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cx(
                "flex items-center gap-2 border px-3 py-2 transition-colors",
                tab === t.id
                  ? "border-ink bg-ink text-paper"
                  : "border-[var(--color-line)] text-ink hover:border-ink/40",
              )}
            >
              <Icon name={t.icon} size={15} />
              <span className="display text-[13px]">{t.label}</span>
            </button>
          ))}
        </div>
      </Panel>

      {tab === "books" && <BooksPanel />}
      {tab === "film" && <FilmPanel />}
      {tab === "vocab" && <VocabPanel />}
    </div>
  );
}

/* ---------------- BOOKS ---------------- */
const BOOK_SECTIONS: { status: BookStatus; label: string }[] = [
  { status: "reading", label: "Reading now" },
  { status: "queued", label: "Up next" },
  { status: "finished", label: "Finished" },
  { status: "abandoned", label: "Set aside" },
];

function BooksPanel() {
  const books = useStore((s) => s.books);
  const values = useStore((s) => s.values);
  const addBook = useStore((s) => s.addBook);
  const [edit, setEdit] = useState<Book | null>(null);

  const add = () => setEdit(addBook({ status: "reading", startedAt: todayISO() }));

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button icon="plus" onClick={add}>
          Add book
        </Button>
      </div>
      <div className="space-y-5">
        {BOOK_SECTIONS.map(({ status, label }) => {
          const list = books.filter((b) => b.status === status);
          if (!list.length) return null;
          return (
            <div key={status}>
              <div className="mb-2 flex items-center gap-3">
                <Label ink>// {label}</Label>
                <div className="h-px flex-1 bg-[var(--color-line)]" />
                <Label>{list.length}</Label>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {list.map((b) => {
                  const value = values.find((v) => v.id === b.valueId);
                  const prog = b.pages && b.currentPage ? b.currentPage / b.pages : 0;
                  return (
                    <button
                      type="button"
                      key={b.id}
                      onClick={() => setEdit(b)}
                      className="group flex flex-col border border-[var(--color-line)] p-3.5 text-left transition-colors hover:border-ink"
                    >
                      <div className="flex items-start gap-2.5">
                        <span
                          className="mt-0.5 h-9 w-7 shrink-0 border-l-2"
                          style={{
                            borderColor: value?.hue ?? "var(--color-mist)",
                            background: "var(--color-paper-3)",
                          }}
                        />
                        <div className="min-w-0 flex-1">
                          <p className="display truncate text-[14px] leading-tight">{b.title}</p>
                          <p className="mono mt-0.5 truncate text-[10px] text-stone">{b.author}</p>
                        </div>
                      </div>
                      {b.status === "reading" && b.pages && (
                        <div className="mt-3">
                          <ProgressBar value={prog} />
                          <p className="mono mt-1 text-[9px] text-mist">
                            {b.currentPage} / {b.pages} pp · {Math.round(prog * 100)}%
                          </p>
                        </div>
                      )}
                      {(b.status === "finished" || b.rating) && (
                        <div className="mt-3">
                          <Stars value={b.rating} size={13} />
                        </div>
                      )}
                      {b.note && (
                        <p className="mono mt-2 line-clamp-2 text-[10px] text-stone">{b.note}</p>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
        {!books.length && <Empty label="No books yet" />}
      </div>
      <BookDrawer book={edit} onClose={() => setEdit(null)} />
    </>
  );
}

/* ---------------- FILM ---------------- */
function FilmPanel() {
  const movies = useStore((s) => s.movies);
  const addMovie = useStore((s) => s.addMovie);
  const updateMovie = useStore((s) => s.updateMovie);
  const removeMovie = useStore((s) => s.removeMovie);

  const watched = movies.filter((m) => m.status === "watched");
  const queued = movies.filter((m) => m.status === "queued");

  const card = (m: Movie) => (
    <div key={m.id} className="group flex flex-col gap-2 border border-[var(--color-line)] p-3.5">
      <div className="flex items-start gap-2">
        <Icon name="film" size={15} className="mt-0.5 shrink-0 text-ash" />
        <input
          value={m.title}
          onChange={(e) => updateMovie(m.id, { title: e.target.value })}
          className="display flex-1 bg-transparent text-[14px] leading-tight outline-none"
        />
        <button
          type="button"
          onClick={() => removeMovie(m.id)}
          aria-label="Delete"
          className="text-mist opacity-0 transition-opacity hover:text-signal group-hover:opacity-100"
        >
          <Icon name="trash" size={13} />
        </button>
      </div>
      <p className="mono pl-6 text-[10px] text-stone">
        {m.director}
        {m.year ? ` · ${m.year}` : ""}
      </p>
      <div className="flex items-center justify-between pl-6">
        <Stars
          value={m.rating}
          size={13}
          onChange={(r) =>
            updateMovie(m.id, {
              rating: r,
              status: "watched",
              watchedAt: m.watchedAt ?? todayISO(),
            })
          }
        />
        <button
          type="button"
          onClick={() =>
            updateMovie(m.id, {
              status: m.status === "watched" ? "queued" : "watched",
              watchedAt: m.status === "watched" ? null : todayISO(),
            })
          }
          className="mono text-[9px] uppercase tracking-[0.1em] text-stone hover:text-ink"
        >
          {m.status === "watched"
            ? `seen ${m.watchedAt ? fmtShort(m.watchedAt) : ""}`
            : "mark seen"}
        </button>
      </div>
    </div>
  );

  return (
    <>
      <div className="mb-3 flex justify-end">
        <Button icon="plus" onClick={() => addMovie({ title: "Untitled film", status: "queued" })}>
          Add film
        </Button>
      </div>
      {queued.length > 0 && (
        <Section label="Watchlist" n={queued.length}>
          <Grid>{queued.map(card)}</Grid>
        </Section>
      )}
      {watched.length > 0 && (
        <Section label="Watched" n={watched.length}>
          <Grid>{watched.map(card)}</Grid>
        </Section>
      )}
      {!movies.length && <Empty label="No films yet" />}
    </>
  );
}

/* ---------------- VOCAB ---------------- */
function VocabPanel() {
  const vocab = useStore((s) => s.vocab);
  const addVocab = useStore((s) => s.addVocab);
  const updateVocab = useStore((s) => s.updateVocab);
  const removeVocab = useStore((s) => s.removeVocab);
  const reviewVocab = useStore((s) => s.reviewVocab);

  const today = todayISO();
  const due = vocab.filter((w) => !w.nextDue || w.nextDue <= today);
  const [reviewing, setReviewing] = useState(false);
  const [queue, setQueue] = useState<string[]>([]);
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);

  // Snapshot the review set at start: grading moves a card's nextDue forward, so
  // recomputing from the live `due` filter mid-session would shrink the array.
  const card = vocab.find((w) => w.id === queue[idx]) ?? null;
  const startReview = () => {
    setQueue(due.map((w) => w.id));
    setIdx(0);
    setFlipped(false);
    setReviewing(true);
  };
  const grade = (correct: boolean) => {
    if (card) reviewVocab(card.id, correct);
    setFlipped(false);
    if (idx + 1 >= queue.length) {
      setReviewing(false);
      setIdx(0);
    } else setIdx(idx + 1);
  };

  return (
    <>
      <div className="mb-3 flex items-center justify-between">
        <span className="mono text-[11px] text-stone">
          {due.length} due for review · {vocab.length} total
        </span>
        <div className="flex gap-2">
          {due.length > 0 && !reviewing && (
            <Button solid icon="spark" onClick={startReview}>
              Review {due.length}
            </Button>
          )}
          <Button icon="plus" onClick={() => addVocab({ term: "new word", definition: "" })}>
            Add word
          </Button>
        </div>
      </div>

      {reviewing && card ? (
        <Panel ticks className="mx-auto max-w-lg p-8 text-center">
          <Label>
            {idx + 1} / {queue.length} · box {card.box}
          </Label>
          <p className="display mt-4 text-4xl">{card.term}</p>
          <p className="mono mt-1 text-[11px] text-stone">{card.language}</p>
          {flipped ? (
            <div className="mt-5">
              <p className="text-[15px] leading-relaxed">{card.definition || "—"}</p>
              {card.example && (
                <p className="mono mt-3 text-[12px] italic text-stone">"{card.example}"</p>
              )}
              <div className="mt-6 flex justify-center gap-2">
                <Button onClick={() => grade(false)}>Again</Button>
                <Button solid onClick={() => grade(true)}>
                  Got it →
                </Button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setFlipped(true)} className="btn mt-6">
              Reveal
            </button>
          )}
        </Panel>
      ) : (
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {vocab.map((w) => (
            <div key={w.id} className="group border border-[var(--color-line)] p-3.5">
              <div className="flex items-baseline justify-between gap-2">
                <input
                  value={w.term}
                  onChange={(e) => updateVocab(w.id, { term: e.target.value })}
                  className="display flex-1 bg-transparent text-lg outline-none"
                />
                <Tag>BOX {w.box}</Tag>
                <button
                  type="button"
                  onClick={() => removeVocab(w.id)}
                  aria-label="Delete"
                  className="text-mist opacity-0 hover:text-signal group-hover:opacity-100"
                >
                  <Icon name="trash" size={12} />
                </button>
              </div>
              <textarea
                value={w.definition}
                onChange={(e) => updateVocab(w.id, { definition: e.target.value })}
                rows={2}
                placeholder="definition…"
                className="mono mt-2 w-full resize-none bg-transparent text-[12px] leading-relaxed text-ash outline-none placeholder:text-mist"
              />
              <p className="mono mt-1 text-[10px] text-mist">
                {w.language} · due {w.nextDue ? fmtShort(w.nextDue) : "now"}
              </p>
            </div>
          ))}
          {!vocab.length && <Empty label="No words yet" />}
        </div>
      )}
    </>
  );
}

/* ---------------- shared ---------------- */
function Section({ label, n, children }: { label: string; n: number; children: React.ReactNode }) {
  return (
    <div className="mb-5">
      <div className="mb-2 flex items-center gap-3">
        <Label ink>// {label}</Label>
        <div className="h-px flex-1 bg-[var(--color-line)]" />
        <Label>{n}</Label>
      </div>
      {children}
    </div>
  );
}
function Grid({ children }: { children: React.ReactNode }) {
  return <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
function Empty({ label }: { label: string }) {
  return <p className="mono py-16 text-center text-[12px] text-mist">{label}</p>;
}
