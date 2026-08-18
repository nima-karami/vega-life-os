import { addDays, format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { formatShortDate, getWeekDays, todayISO, weekStartOf } from "@/core/lib/date";
import { useStore } from "@/core/store";
import {
  Button,
  ConfirmDialog,
  cx,
  Gauge,
  Icon,
  IconButton,
  Label,
  Panel,
  SectionHead,
} from "@/core/ui";
import { useValueColor } from "@/features/values/useValueColor";
import { MoodWeekPanel } from "./MoodWeekPanel";
import { REVIEW_PROMPTS } from "./model";
import { computeMoodWeek } from "./mood";
import { computeWeekRollup } from "./rollup";

/** Advisory cap for the past-reviews list (D5) — "show more" reveals the rest. */
const PAST_PAGE = 50;

/** Calm primary tone for chart strokes/fills (matches HeroUI primary). */
const CHART_PRIMARY = "var(--color-accent)";

const REVIEW_FIELD_CLASS =
  "w-full resize-y rounded-[12px] border border-border bg-surface px-3 py-2 text-[16px] text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent sm:text-sm";

export function ReviewSection() {
  const tasks = useStore((s) => s.tasks);
  const values = useStore((s) => s.values);
  const habits = useStore((s) => s.habits);
  const journal = useStore((s) => s.journal);
  const reviews = useStore((s) => s.reviews);
  const saveReview = useStore((s) => s.saveReview);
  const pushToast = useStore((s) => s.pushToast);

  const [weekRef, setWeekRef] = useState(() => new Date());
  const periodKey = format(weekStartOf(weekRef), "yyyy-MM-dd");
  const days = useMemo(() => getWeekDays(weekRef), [weekRef]);
  const weekIsos = useMemo(() => days.map((d) => d.iso), [days]);
  const existing = reviews.find((r) => r.periodKey === periodKey);

  const rollup = useMemo(
    () => computeWeekRollup(tasks, values, habits, weekIsos, todayISO()),
    [tasks, values, habits, weekIsos],
  );
  const moodWeek = useMemo(
    () => computeMoodWeek(journal, periodKey, todayISO()),
    [journal, periodKey],
  );

  // prompt answers (prefill from existing); reset when the active review changes
  const [answers, setAnswers] = useState<string[]>(() => REVIEW_PROMPTS.map(() => ""));
  const [baseline, setBaseline] = useState<string[]>(() => REVIEW_PROMPTS.map(() => ""));
  useEffect(() => {
    const next = REVIEW_PROMPTS.map((q) => existing?.prompts.find((p) => p.q === q)?.a ?? "");
    setAnswers(next);
    setBaseline(next);
  }, [existing]);

  const dirty = answers.some((a, i) => a !== baseline[i]);
  const [saving, setSaving] = useState(false);

  // unsaved-edit guard: a pending week-change held until the user decides
  const [pendingWeek, setPendingWeek] = useState<Date | null>(null);

  const requestWeek = (next: Date) => {
    if (dirty) setPendingWeek(next);
    else setWeekRef(next);
  };

  const save = () => {
    setSaving(true);
    try {
      saveReview({
        periodKey,
        completion: rollup.completion,
        prompts: REVIEW_PROMPTS.map((q, i) => ({ q, a: answers[i] })),
      });
      setBaseline(answers);
      pushToast(existing ? "Reflection updated" : "Reflection saved");
    } catch {
      pushToast("Couldn't save your reflection — try again");
    } finally {
      setSaving(false);
    }
  };

  const isThisWeek = periodKey === format(weekStartOf(new Date()), "yyyy-MM-dd");
  const isFuture = periodKey > format(weekStartOf(new Date()), "yyyy-MM-dd");
  const noActivity = rollup.byValue.every((x) => x.n === 0) && rollup.completion === 0;

  const [shown, setShown] = useState(PAST_PAGE);
  const visibleReviews = reviews.slice(0, shown);

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Weekly review</h2>
          <p className="mt-1 text-sm text-muted">
            {formatShortDate(days[0].iso)} – {formatShortDate(days[6].iso)}
            {isThisWeek && " · in progress"}
            {isFuture && " · upcoming"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <IconButton
            name="chevL"
            label="Previous week"
            onPress={() => requestWeek(addDays(weekStartOf(weekRef), -7))}
          />
          <Button onPress={() => requestWeek(new Date())}>This week</Button>
          <IconButton
            name="chevR"
            label="Next week"
            onPress={() => requestWeek(addDays(weekStartOf(weekRef), 7))}
          />
        </div>
      </div>

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="space-y-5">
          <Panel className="flex items-center justify-center p-6">
            <Gauge
              value={rollup.completion}
              size={76}
              stroke={7}
              hue={CHART_PRIMARY}
              sub="completion"
            />
          </Panel>

          <MoodWeekPanel week={moodWeek} />

          {noActivity ? (
            <Panel className="p-6">
              <SectionHead title="this week" meta="empty" />
              <p className="mt-3 text-sm leading-relaxed text-muted">
                Nothing logged this week yet — but you can still write a reflection below.
              </p>
            </Panel>
          ) : (
            <>
              <Panel className="p-5">
                <SectionHead title="balance" meta="by value" />
                <div className="mt-3 space-y-2">
                  {rollup.byValue.map(({ v, n }) => (
                    <ValueBar key={v.id} valueId={v.id} name={v.name} n={n} max={rollup.maxV} />
                  ))}
                </div>
              </Panel>

              <Panel className="p-5">
                <SectionHead title="habits" meta="this week" />
                <div className="mt-3 space-y-1.5">
                  {rollup.habitRows.map(({ h, rate, done, total }) => (
                    <div key={h.id} className="flex items-center justify-between">
                      <span className="truncate text-xs text-muted">{h.name}</span>
                      <span className="text-xs tabular-nums text-muted">
                        {done}/{total} · {Math.round(rate * 100)}%
                      </span>
                    </div>
                  ))}
                  {!rollup.habitRows.length && (
                    <p className="text-sm text-muted">No habit activity this week.</p>
                  )}
                </div>
              </Panel>
            </>
          )}
        </div>

        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Panel className="p-5">
              <SectionHead title="wins" meta={String(rollup.wins.length)} />
              <ul className="mt-3 space-y-1.5">
                {rollup.wins.map((t) => (
                  <li key={t.id} className="flex items-start gap-2">
                    <Icon name="check" size={12} className="mt-0.5 shrink-0 text-success" />
                    <span className="text-sm text-foreground">{t.title}</span>
                  </li>
                ))}
                {!rollup.wins.length && (
                  <li className="text-sm text-muted">No goal-work completed yet.</li>
                )}
              </ul>
            </Panel>
            <Panel className="p-5">
              <SectionHead title="slipped" meta={String(rollup.slipped.length)} />
              <ul className="mt-3 space-y-1.5">
                {rollup.slipped.map((t) => (
                  <li key={t.id} className="flex items-start gap-2">
                    <Icon name="alert" size={12} className="mt-0.5 shrink-0 text-danger" />
                    <span className="text-sm text-muted">
                      {t.title} <span className="text-xs text-muted">{t.date?.slice(5)}</span>
                    </span>
                  </li>
                ))}
                {!rollup.slipped.length && (
                  <li className="text-sm text-muted">Nothing left behind. Clean week.</li>
                )}
              </ul>
            </Panel>
          </div>

          <Panel className="p-6">
            <div className="flex items-center justify-between">
              <SectionHead title="reflection" className="flex-1" />
              {dirty ? (
                <Label className="text-danger">unsaved changes</Label>
              ) : (
                existing && <Label>saved {existing.createdAt.slice(5, 10)}</Label>
              )}
            </div>
            <div className="mt-4 space-y-4">
              {REVIEW_PROMPTS.map((q, i) => (
                <label key={q} className="block space-y-1.5">
                  <span className="text-xs text-muted">{q}</span>
                  <textarea
                    value={answers[i]}
                    disabled={saving}
                    onChange={(e) =>
                      setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))
                    }
                    rows={2}
                    placeholder="…"
                    className={REVIEW_FIELD_CLASS}
                  />
                </label>
              ))}
              <div className="flex justify-end">
                <Button solid icon="check" onPress={save} isDisabled={saving} aria-busy={saving}>
                  {saving ? "Saving…" : existing ? "Update reflection" : "Save reflection"}
                </Button>
              </div>
            </div>
          </Panel>

          {reviews.length > 0 && (
            <Panel className="p-5">
              <SectionHead title="past reviews" meta={String(reviews.length)} />
              <div className="mt-3 space-y-1.5">
                {visibleReviews.map((r) => (
                  <button
                    type="button"
                    key={r.id}
                    aria-current={r.periodKey === periodKey ? "true" : undefined}
                    onClick={() => requestWeek(new Date(`${r.periodKey}T00:00`))}
                    className={cx(
                      "flex w-full items-center gap-3 rounded-[12px] border px-3 py-2 text-left transition-colors hover:border-accent",
                      r.periodKey === periodKey ? "border-accent" : "border-border",
                    )}
                  >
                    <span className="text-sm text-foreground">
                      week of {formatShortDate(r.periodKey)}
                    </span>
                    <span className="text-xs text-muted">{Math.round(r.completion * 100)}%</span>
                    <span className="ml-auto truncate text-xs text-muted">
                      {r.prompts.find((p) => p.a)?.a ?? "—"}
                    </span>
                  </button>
                ))}
              </div>
              {reviews.length > shown && (
                <div className="mt-3 flex justify-center">
                  <Button onPress={() => setShown((n) => n + PAST_PAGE)}>
                    Show more ({reviews.length - shown})
                  </Button>
                </div>
              )}
            </Panel>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={pendingWeek !== null}
        title="Unsaved reflection"
        body="You have unsaved changes to this week's reflection. Save them before leaving, or discard?"
        confirmLabel="Save & continue"
        cancelLabel="Discard"
        onConfirm={() => {
          save();
          if (pendingWeek) setWeekRef(pendingWeek);
          setPendingWeek(null);
        }}
        onClose={() => {
          // "Discard" — drop edits and proceed to the pending week
          if (pendingWeek) setWeekRef(pendingWeek);
          setPendingWeek(null);
        }}
      />
    </div>
  );
}

function ValueBar({
  valueId,
  name,
  n,
  max,
}: {
  valueId: string;
  name: string;
  n: number;
  max: number;
}) {
  const color = useValueColor(valueId);
  return (
    <div className="flex items-center gap-2">
      <span className="w-16 shrink-0 truncate text-xs text-muted">{name}</span>
      <div className="h-2.5 flex-1 rounded-full bg-surface-secondary">
        <div
          className="h-2.5 rounded-full"
          style={{ width: `${(n / max) * 100}%`, background: color }}
        />
      </div>
      <span className="w-5 text-right text-xs text-muted">{n}</span>
    </div>
  );
}
