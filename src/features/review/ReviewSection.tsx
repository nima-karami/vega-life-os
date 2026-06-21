import { addDays, format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { fmtShort, todayISO, weekDays, weekStartOf } from "@/core/lib/date";
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
import { REVIEW_PROMPTS } from "./model";
import { weekRollup } from "./rollup";

/** Advisory cap for the past-reviews list (D5) — "show more" reveals the rest. */
const PAST_PAGE = 50;

export function ReviewSection() {
  const tasks = useStore((s) => s.tasks);
  const values = useStore((s) => s.values);
  const habits = useStore((s) => s.habits);
  const reviews = useStore((s) => s.reviews);
  const saveReview = useStore((s) => s.saveReview);
  const pushToast = useStore((s) => s.pushToast);

  const [weekRef, setWeekRef] = useState(() => new Date());
  const periodKey = format(weekStartOf(weekRef), "yyyy-MM-dd");
  const days = useMemo(() => weekDays(weekRef), [weekRef]);
  const weekIsos = useMemo(() => days.map((d) => d.iso), [days]);
  const existing = reviews.find((r) => r.periodKey === periodKey);

  const roll = useMemo(
    () => weekRollup(tasks, values, habits, weekIsos, todayISO()),
    [tasks, values, habits, weekIsos],
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
        completion: roll.completion,
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
  const noActivity = roll.byValue.every((x) => x.n === 0) && roll.completion === 0;

  const [shown, setShown] = useState(PAST_PAGE);
  const visibleReviews = reviews.slice(0, shown);

  return (
    <div className="mx-auto max-w-[1100px]">
      <Panel className="mb-4 flex flex-wrap items-center gap-4 px-5 py-4">
        <div>
          <Label>// review · the mirror</Label>
          <h2 className="display mt-1 text-3xl">Weekly review</h2>
          <p className="mono mt-1 text-[11px] text-stone">
            {fmtShort(days[0].iso)} – {fmtShort(days[6].iso)}
            {isThisWeek && " · in progress"}
            {isFuture && " · upcoming"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <IconButton
            name="chevL"
            label="Previous week"
            onClick={() => requestWeek(addDays(weekStartOf(weekRef), -7))}
          />
          <Button onClick={() => requestWeek(new Date())}>This week</Button>
          <IconButton
            name="chevR"
            label="Next week"
            onClick={() => requestWeek(addDays(weekStartOf(weekRef), 7))}
          />
        </div>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* rollup */}
        <div className="space-y-4">
          <Panel className="flex items-center gap-4 p-5">
            <Gauge value={roll.completion} size={76} stroke={7} sub="done" />
            <div>
              <p className="display text-3xl leading-none">{Math.round(roll.completion * 100)}%</p>
              <Label className="mt-1">completion</Label>
            </div>
          </Panel>

          {noActivity ? (
            <Panel className="p-5">
              <SectionHead title="this week" meta="empty" />
              <p className="mono mt-3 text-[12px] leading-relaxed text-stone">
                Nothing logged this week yet — but you can still write a reflection below.
              </p>
            </Panel>
          ) : (
            <>
              <Panel className="p-4">
                <SectionHead title="balance" meta="done · by value" />
                <div className="mt-3 space-y-2">
                  {roll.byValue.map(({ v, n }) => (
                    <ValueBar key={v.id} valueId={v.id} name={v.name} n={n} max={roll.maxV} />
                  ))}
                </div>
              </Panel>

              <Panel className="p-4">
                <SectionHead title="habits" meta="this week" />
                <div className="mt-3 space-y-1.5">
                  {roll.habitRows.map(({ h, rate, done, total }) => (
                    <div key={h.id} className="flex items-center justify-between">
                      <span className="mono truncate text-[10px] text-ash">{h.name}</span>
                      <span className="mono text-[10px] tabular-nums text-stone">
                        {done}/{total} · {Math.round(rate * 100)}%
                      </span>
                    </div>
                  ))}
                  {!roll.habitRows.length && (
                    <p className="mono text-[11px] text-mist">No habits scheduled this week.</p>
                  )}
                </div>
              </Panel>
            </>
          )}
        </div>

        {/* wins/slipped + reflection */}
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Panel className="p-4">
              <SectionHead title="wins" meta={String(roll.wins.length)} />
              <ul className="mt-3 space-y-1.5">
                {roll.wins.map((t) => (
                  <li key={t.id} className="flex items-start gap-2">
                    <Icon name="check" size={12} className="mt-0.5 shrink-0 text-good" />
                    <span className="text-[12px]">{t.title}</span>
                  </li>
                ))}
                {!roll.wins.length && (
                  <li className="mono text-[11px] text-mist">No goal-work completed yet.</li>
                )}
              </ul>
            </Panel>
            <Panel className="p-4">
              <SectionHead title="slipped" meta={String(roll.slipped.length)} />
              <ul className="mt-3 space-y-1.5">
                {roll.slipped.map((t) => (
                  <li key={t.id} className="flex items-start gap-2">
                    <Icon
                      name="alert"
                      size={12}
                      className="mt-0.5 shrink-0"
                      style={{ color: "var(--color-signal)" }}
                    />
                    <span className="text-[12px] text-stone">
                      {t.title}{" "}
                      <span className="mono text-[9px] text-mist">{t.date?.slice(5)}</span>
                    </span>
                  </li>
                ))}
                {!roll.slipped.length && (
                  <li className="mono text-[11px] text-mist">Nothing left behind. Clean week.</li>
                )}
              </ul>
            </Panel>
          </div>

          <Panel ticks className="p-5">
            <div className="flex items-center justify-between">
              <SectionHead title="reflection" className="flex-1" />
              {dirty ? (
                <Label className="text-signal">unsaved changes</Label>
              ) : (
                existing && <Label>saved {existing.createdAt.slice(5, 10)}</Label>
              )}
            </div>
            <div className="mt-4 space-y-4">
              {REVIEW_PROMPTS.map((q, i) => (
                <div key={q}>
                  <label className="mono text-[12px] text-ink">
                    {q}
                    <textarea
                      value={answers[i]}
                      disabled={saving}
                      onChange={(e) =>
                        setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))
                      }
                      rows={2}
                      placeholder="…"
                      className="mono mt-1.5 w-full resize-none rounded-[var(--radius-sm)] border border-[var(--color-line)] bg-transparent p-2.5 text-[12px] leading-relaxed outline-none placeholder:text-mist focus:border-accent disabled:opacity-60"
                    />
                  </label>
                </div>
              ))}
              <div className="flex justify-end">
                <Button
                  solid
                  icon="check"
                  onClick={save}
                  disabled={saving}
                  aria-busy={saving}
                  aria-disabled={saving}
                >
                  {saving ? "Saving…" : existing ? "Update reflection" : "Save reflection"}
                </Button>
              </div>
            </div>
          </Panel>

          {/* history */}
          {reviews.length > 0 && (
            <Panel className="p-4">
              <SectionHead title="past reviews" meta={String(reviews.length)} />
              <div className="mt-3 space-y-1.5">
                {visibleReviews.map((r) => (
                  <button
                    type="button"
                    key={r.id}
                    aria-current={r.periodKey === periodKey ? "true" : undefined}
                    onClick={() => requestWeek(new Date(`${r.periodKey}T00:00`))}
                    className={cx(
                      "flex w-full items-center gap-3 rounded-[var(--radius-sm)] border px-3 py-2 text-left transition-colors hover:border-accent",
                      r.periodKey === periodKey ? "border-accent" : "border-[var(--color-line)]",
                    )}
                  >
                    <span className="mono text-[11px] text-ink">
                      week of {fmtShort(r.periodKey)}
                    </span>
                    <span className="mono text-[10px] text-stone">
                      {Math.round(r.completion * 100)}%
                    </span>
                    <span className="mono ml-auto truncate text-[10px] text-mist">
                      {r.prompts.find((p) => p.a)?.a ?? "—"}
                    </span>
                  </button>
                ))}
              </div>
              {reviews.length > shown && (
                <div className="mt-3 flex justify-center">
                  <Button onClick={() => setShown((n) => n + PAST_PAGE)}>
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
      <span className="mono w-16 shrink-0 truncate text-[10px] uppercase text-ash">{name}</span>
      <div className="h-2.5 flex-1 rounded-full bg-[var(--color-line-soft)]">
        <div
          className="h-2.5 rounded-full"
          style={{ width: `${(n / max) * 100}%`, background: color }}
        />
      </div>
      <span className="mono w-5 text-right text-[10px] text-stone">{n}</span>
    </div>
  );
}
