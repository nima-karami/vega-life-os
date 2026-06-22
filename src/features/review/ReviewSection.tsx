import { Textarea } from "@heroui/react";
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

/** Calm primary tone for chart strokes/fills (matches HeroUI primary). */
const CHART_PRIMARY = "var(--color-accent)";

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
    <div className="w-full">
      <div className="mb-6 flex flex-wrap items-end gap-4">
        <div>
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Weekly review</h2>
          <p className="mt-1 text-sm text-default-500">
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
      </div>

      <div className="grid gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        {/* rollup */}
        <div className="space-y-5">
          <Panel className="flex items-center gap-4 p-6">
            <Gauge value={roll.completion} size={76} stroke={7} hue={CHART_PRIMARY} sub="done" />
            <div>
              <p className="text-3xl font-semibold leading-none tracking-tight text-foreground">
                {Math.round(roll.completion * 100)}%
              </p>
              <Label className="mt-1">completion</Label>
            </div>
          </Panel>

          {noActivity ? (
            <Panel className="p-6">
              <SectionHead title="this week" meta="empty" />
              <p className="mt-3 text-small leading-relaxed text-default-500">
                Nothing logged this week yet — but you can still write a reflection below.
              </p>
            </Panel>
          ) : (
            <>
              <Panel className="p-5">
                <SectionHead title="balance" meta="by value" />
                <div className="mt-3 space-y-2">
                  {roll.byValue.map(({ v, n }) => (
                    <ValueBar key={v.id} valueId={v.id} name={v.name} n={n} max={roll.maxV} />
                  ))}
                </div>
              </Panel>

              <Panel className="p-5">
                <SectionHead title="habits" meta="this week" />
                <div className="mt-3 space-y-1.5">
                  {roll.habitRows.map(({ h, rate, done, total }) => (
                    <div key={h.id} className="flex items-center justify-between">
                      <span className="truncate text-tiny text-default-500">{h.name}</span>
                      <span className="text-tiny tabular-nums text-default-500">
                        {done}/{total} · {Math.round(rate * 100)}%
                      </span>
                    </div>
                  ))}
                  {!roll.habitRows.length && (
                    <p className="text-small text-default-400">No habits scheduled this week.</p>
                  )}
                </div>
              </Panel>
            </>
          )}
        </div>

        {/* wins/slipped + reflection */}
        <div className="space-y-5">
          <div className="grid gap-5 sm:grid-cols-2">
            <Panel className="p-5">
              <SectionHead title="wins" meta={String(roll.wins.length)} />
              <ul className="mt-3 space-y-1.5">
                {roll.wins.map((t) => (
                  <li key={t.id} className="flex items-start gap-2">
                    <Icon name="check" size={12} className="mt-0.5 shrink-0 text-success" />
                    <span className="text-small text-foreground">{t.title}</span>
                  </li>
                ))}
                {!roll.wins.length && (
                  <li className="text-small text-default-400">No goal-work completed yet.</li>
                )}
              </ul>
            </Panel>
            <Panel className="p-5">
              <SectionHead title="slipped" meta={String(roll.slipped.length)} />
              <ul className="mt-3 space-y-1.5">
                {roll.slipped.map((t) => (
                  <li key={t.id} className="flex items-start gap-2">
                    <Icon name="alert" size={12} className="mt-0.5 shrink-0 text-danger" />
                    <span className="text-small text-default-500">
                      {t.title}{" "}
                      <span className="text-tiny text-default-400">{t.date?.slice(5)}</span>
                    </span>
                  </li>
                ))}
                {!roll.slipped.length && (
                  <li className="text-small text-default-400">Nothing left behind. Clean week.</li>
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
                <Textarea
                  key={q}
                  label={q}
                  labelPlacement="outside"
                  value={answers[i]}
                  isDisabled={saving}
                  onValueChange={(val) => setAnswers((a) => a.map((x, j) => (j === i ? val : x)))}
                  minRows={2}
                  variant="bordered"
                  placeholder="…"
                />
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
                      "flex w-full items-center gap-3 rounded-medium border px-3 py-2 text-left transition-colors hover:border-primary",
                      r.periodKey === periodKey ? "border-primary" : "border-divider",
                    )}
                  >
                    <span className="text-small text-foreground">
                      week of {fmtShort(r.periodKey)}
                    </span>
                    <span className="text-tiny text-default-500">
                      {Math.round(r.completion * 100)}%
                    </span>
                    <span className="ml-auto truncate text-tiny text-default-400">
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
      <span className="w-16 shrink-0 truncate text-tiny text-default-500">{name}</span>
      <div className="h-2.5 flex-1 rounded-full bg-default-200">
        <div
          className="h-2.5 rounded-full"
          style={{ width: `${(n / max) * 100}%`, background: color }}
        />
      </div>
      <span className="w-5 text-right text-tiny text-default-500">{n}</span>
    </div>
  );
}
