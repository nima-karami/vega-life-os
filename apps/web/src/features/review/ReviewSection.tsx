import { addDays, format } from "date-fns";
import { useEffect, useMemo, useState } from "react";
import { formatShortDate, getWeekDays, localDayOf, todayISO, weekStartOf } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { Button, ConfirmDialog, IconButton, Label, Panel, SectionHead } from "@/core/ui";
import { splitValuesBySeason } from "@/features/values/selectors";
import { DoneThisWeekPanel } from "./DoneThisWeekPanel";
import { GratitudeWeekPanel } from "./GratitudeWeekPanel";
import { HabitsWeekPanel } from "./HabitsWeekPanel";
import { JournalWeekPanel } from "./JournalWeekPanel";
import { MoodWeekPanel } from "./MoodWeekPanel";
import { REVIEW_PROMPTS, type ReviewCheckIn } from "./model";
import { computeMoodWeek } from "./mood";
import { PastReviewsPanel } from "./PastReviewsPanel";
import {
  haveCheckInsChanged,
  listCheckInValues,
  mergePromptsForSave,
  splitReviewPrompts,
} from "./review-form";
import { computeWeekRollup } from "./rollup";
import { ValueCheckIn } from "./ValueCheckIn";

const REVIEW_FIELD_CLASS =
  "w-full resize-y rounded-[12px] border border-border bg-surface px-3 py-2 text-[16px] text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent sm:text-sm";

const NO_CHECK_INS: ReviewCheckIn[] = [];

export function ReviewSection() {
  const tasks = useStore((s) => s.tasks);
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
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
    () => computeWeekRollup(tasks, { values, goals, habits }, weekIsos, todayISO()),
    [tasks, values, goals, habits, weekIsos],
  );
  const moodWeek = useMemo(
    () => computeMoodWeek(journal, periodKey, todayISO()),
    [journal, periodKey],
  );

  // form state prefilled from the stored review; reset when the active review changes
  const [answers, setAnswers] = useState<string[]>(() => REVIEW_PROMPTS.map(() => ""));
  const [legacy, setLegacy] = useState(() => splitReviewPrompts(undefined).legacy);
  const [checkIns, setCheckIns] = useState<ReviewCheckIn[]>(NO_CHECK_INS);
  const [baseline, setBaseline] = useState({ answers, checkIns });
  useEffect(() => {
    const split = splitReviewPrompts(existing);
    const stored = existing?.checkIns ?? NO_CHECK_INS;
    setAnswers(split.answers);
    setLegacy(split.legacy);
    setCheckIns(stored);
    setBaseline({ answers: split.answers, checkIns: stored });
  }, [existing]);

  const dirty =
    answers.some((a, i) => a !== baseline.answers[i]) ||
    haveCheckInsChanged(checkIns, baseline.checkIns);
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
      saveReview({ periodKey, prompts: mergePromptsForSave(answers, legacy), checkIns });
      setBaseline({ answers, checkIns });
      pushToast(existing ? "Reflection updated" : "Reflection saved");
    } catch {
      pushToast("Couldn't save your reflection. Try again");
    } finally {
      setSaving(false);
    }
  };

  const thisWeekKey = format(weekStartOf(new Date()), "yyyy-MM-dd");
  const isThisWeek = periodKey === thisWeekKey;
  const isFuture = periodKey > thisWeekKey;
  const hasResting = useMemo(() => splitValuesBySeason(values).resting.length > 0, [values]);
  const checkInValues = useMemo(
    () => listCheckInValues(values, checkIns, baseline.checkIns),
    [values, checkIns, baseline.checkIns],
  );

  return (
    <div className="w-full">
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold tracking-tight text-foreground">Weekly review</h2>
          <p className="mt-1 text-sm text-muted">
            {formatShortDate(days[0].iso)}-{formatShortDate(days[6].iso)}
            {isThisWeek && " · in progress"}
            {isFuture && " · upcoming"}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2 sm:ml-auto">
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

      {/* minmax(0,…) on the phone column too, or a long past-review preview inflates it past the viewport. */}
      <div className="grid grid-cols-[minmax(0,1fr)] gap-5 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="space-y-5">
          <DoneThisWeekPanel groups={rollup.doneByValue} isThisWeek={isThisWeek} />
          <GratitudeWeekPanel journal={journal} weekStartISO={periodKey} />
          <MoodWeekPanel week={moodWeek} />
          <HabitsWeekPanel rows={rollup.habitRows} />
        </div>

        <div className="space-y-5">
          <ValueCheckIn
            values={checkInValues}
            hasResting={hasResting}
            checkIns={checkIns}
            onChange={setCheckIns}
          />

          <Panel className="p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <SectionHead title="Reflection" className="flex-1" />
              {dirty ? (
                <span className="text-xs text-danger">Unsaved changes</span>
              ) : (
                existing && <Label>Saved {localDayOf(existing.createdAt).slice(5)}</Label>
              )}
            </div>
            {legacy.length > 0 && (
              <div className="mt-4 space-y-3 rounded-[12px] bg-surface-secondary p-3">
                <span className="text-xs font-medium text-muted">Earlier answers</span>
                {legacy.map((p) => (
                  <div key={p.q} className="space-y-0.5">
                    <span className="block text-xs text-muted">{p.q}</span>
                    <p className="whitespace-pre-wrap text-sm text-foreground">
                      {p.a || "No answer"}
                    </p>
                  </div>
                ))}
              </div>
            )}
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

          <JournalWeekPanel journal={journal} weekIsos={weekIsos} />

          {reviews.length > 0 && (
            <PastReviewsPanel
              reviews={reviews}
              activeKey={periodKey}
              onOpen={(key) => requestWeek(new Date(`${key}T00:00`))}
            />
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
