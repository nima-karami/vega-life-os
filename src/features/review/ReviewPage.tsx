import { useMemo, useState, useEffect } from "react";
import { addDays, format } from "date-fns";
import { useStore } from "@/core/store";
import { cx, Panel, SectionHead, Label, Button, IconButton, Gauge, Icon } from "@/core/ui";
import { weekDays, weekStartOf, fmtShort, todayISO } from "@/core/lib/date";
import { REVIEW_PROMPTS } from "./model";

export function ReviewPage() {
  const tasks = useStore((s) => s.tasks);
  const values = useStore((s) => s.values);
  const habits = useStore((s) => s.habits);
  const reviews = useStore((s) => s.reviews);
  const saveReview = useStore((s) => s.saveReview);
  const pushToast = useStore((s) => s.pushToast);

  const [weekRef, setWeekRef] = useState(() => new Date());
  const periodKey = format(weekStartOf(weekRef), "yyyy-MM-dd");
  const days = useMemo(() => weekDays(weekRef), [weekRef]);
  const weekIsos = days.map((d) => d.iso);
  const existing = reviews.find((r) => r.periodKey === periodKey);

  // rollup
  const roll = useMemo(() => {
    const wk = tasks.filter((t) => t.date && weekIsos.includes(t.date));
    const counted = wk.filter((t) => t.status !== "skip");
    const done = wk.filter((t) => t.status === "done");
    const completion = counted.length ? done.length / counted.length : 0;
    const byValue = values.map((v) => ({ v, n: done.filter((t) => t.valueId === v.id).length }));
    const maxV = Math.max(1, ...byValue.map((x) => x.n));
    const wins = done.filter((t) => t.goalId).slice(0, 6);
    const today = todayISO();
    const misses = wk.filter((t) => t.date! < today && t.status !== "done" && t.status !== "skip").slice(0, 6);
    const habitRows = habits.map((h) => {
      const sched = wk.filter((t) => t.habitId === h.id && t.status !== "skip");
      const hd = sched.filter((t) => t.status === "done").length;
      return { h, rate: sched.length ? hd / sched.length : 0, done: hd, total: sched.length };
    });
    return { completion, byValue, maxV, wins, misses, habitRows };
  }, [tasks, values, habits, weekIsos]);

  // prompt answers (prefill from existing)
  const [answers, setAnswers] = useState<string[]>(() => REVIEW_PROMPTS.map(() => ""));
  useEffect(() => {
    setAnswers(REVIEW_PROMPTS.map((q) => existing?.prompts.find((p) => p.q === q)?.a ?? ""));
  }, [periodKey, existing]);

  const save = () => {
    saveReview({
      periodKey,
      completion: roll.completion,
      prompts: REVIEW_PROMPTS.map((q, i) => ({ q, a: answers[i] })),
    });
    pushToast("Reflection saved");
  };

  const isThisWeek = periodKey === format(weekStartOf(new Date()), "yyyy-MM-dd");

  return (
    <div className="mx-auto max-w-[1100px] p-4">
      <Panel className="mb-4 flex flex-wrap items-center gap-4 px-5 py-4">
        <div>
          <Label>// review · the mirror</Label>
          <h1 className="display mt-1 text-3xl">Weekly review</h1>
          <p className="mono mt-1 text-[11px] text-stone">
            {fmtShort(days[0].iso)} – {fmtShort(days[6].iso)} {isThisWeek && "· in progress"}
          </p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <IconButton name="chevL" label="Previous week" onClick={() => setWeekRef(addDays(weekStartOf(weekRef), -7))} />
          <Button onClick={() => setWeekRef(new Date())}>This week</Button>
          <IconButton name="chevR" label="Next week" onClick={() => setWeekRef(addDays(weekStartOf(weekRef), 7))} />
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

          <Panel className="p-4">
            <SectionHead title="balance" meta="done · by value" />
            <div className="mt-3 space-y-2">
              {roll.byValue.map(({ v, n }) => (
                <div key={v.id} className="flex items-center gap-2">
                  <span className="mono w-16 shrink-0 truncate text-[10px] uppercase text-ash">{v.name}</span>
                  <div className="h-2.5 flex-1 bg-[var(--color-line-soft)]"><div className="h-2.5" style={{ width: `${(n / roll.maxV) * 100}%`, background: v.hue }} /></div>
                  <span className="mono w-5 text-right text-[10px] text-stone">{n}</span>
                </div>
              ))}
            </div>
          </Panel>

          <Panel className="p-4">
            <SectionHead title="habits" meta="this week" />
            <div className="mt-3 space-y-1.5">
              {roll.habitRows.map(({ h, rate, done, total }) => (
                <div key={h.id} className="flex items-center justify-between">
                  <span className="mono truncate text-[10px] text-ash">{h.name}</span>
                  <span className="mono text-[10px] tabular-nums text-stone">{done}/{total} · {Math.round(rate * 100)}%</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        {/* wins/misses + reflection */}
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Panel className="p-4">
              <SectionHead title="wins" meta={String(roll.wins.length)} />
              <ul className="mt-3 space-y-1.5">
                {roll.wins.map((t) => (
                  <li key={t.id} className="flex items-start gap-2"><Icon name="check" size={12} className="mt-0.5 shrink-0 text-good" /><span className="text-[12px]">{t.title}</span></li>
                ))}
                {!roll.wins.length && <li className="mono text-[11px] text-mist">No goal-work completed yet.</li>}
              </ul>
            </Panel>
            <Panel className="p-4">
              <SectionHead title="slipped" meta={String(roll.misses.length)} />
              <ul className="mt-3 space-y-1.5">
                {roll.misses.map((t) => (
                  <li key={t.id} className="flex items-start gap-2"><Icon name="alert" size={12} className="mt-0.5 shrink-0" style={{ color: "var(--color-signal)" }} /><span className="text-[12px] text-stone">{t.title} <span className="mono text-[9px] text-mist">{t.date?.slice(5)}</span></span></li>
                ))}
                {!roll.misses.length && <li className="mono text-[11px] text-mist">Nothing left behind. Clean week.</li>}
              </ul>
            </Panel>
          </div>

          <Panel ticks className="p-5">
            <div className="flex items-center justify-between">
              <SectionHead title="reflection" className="flex-1" />
              {existing && <Label>saved {existing.createdAt.slice(5, 10)}</Label>}
            </div>
            <div className="mt-4 space-y-4">
              {REVIEW_PROMPTS.map((q, i) => (
                <div key={q}>
                  <label className="mono text-[12px] text-ink">{q}</label>
                  <textarea
                    value={answers[i]}
                    onChange={(e) => setAnswers((a) => a.map((x, j) => (j === i ? e.target.value : x)))}
                    rows={2}
                    placeholder="…"
                    className="mono mt-1.5 w-full resize-none border border-[var(--color-line)] bg-transparent p-2.5 text-[12px] leading-relaxed outline-none focus:border-ink placeholder:text-mist"
                  />
                </div>
              ))}
              <div className="flex justify-end">
                <Button solid icon="check" onClick={save}>{existing ? "Update reflection" : "Save reflection"}</Button>
              </div>
            </div>
          </Panel>

          {/* history */}
          {reviews.length > 0 && (
            <Panel className="p-4">
              <SectionHead title="past reviews" meta={String(reviews.length)} />
              <div className="mt-3 space-y-1.5">
                {reviews.map((r) => (
                  <button key={r.id} onClick={() => setWeekRef(new Date(r.periodKey + "T00:00"))}
                    className={cx("flex w-full items-center gap-3 border px-3 py-2 text-left transition-colors hover:border-ink",
                      r.periodKey === periodKey ? "border-ink" : "border-[var(--color-line)]")}>
                    <span className="mono text-[11px] text-ink">week of {fmtShort(r.periodKey)}</span>
                    <span className="mono text-[10px] text-stone">{Math.round(r.completion * 100)}%</span>
                    <span className="mono ml-auto truncate text-[10px] text-mist">{r.prompts.find((p) => p.a)?.a ?? "—"}</span>
                  </button>
                ))}
              </div>
            </Panel>
          )}
        </div>
      </div>
    </div>
  );
}
