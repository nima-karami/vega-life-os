import { useState } from "react";
import { useStore } from "@/core/store";
import { cx, Panel, Label, Icon, Tag } from "@/core/ui";
import { todayISO, fmtShort } from "@/core/lib/date";
import { format, subDays } from "date-fns";
import { TaskDrawer, TaskFilterBar, useTaskFilter } from "@/features/tasks";
import type { Task } from "@/features/tasks";

type ColId = "open" | "todo" | "done" | "skip";

const COLUMN_LIMIT = 40;

const COLUMNS: { id: ColId; label: string; sub: string }[] = [
  { id: "open", label: "Open", sub: "unscheduled" },
  { id: "todo", label: "To do", sub: "scheduled" },
  { id: "done", label: "Done", sub: "completed" },
  { id: "skip", label: "Skipped", sub: "passed on" },
];

const inColumn = (t: Task, col: ColId): boolean => {
  if (col === "done") return t.status === "done";
  if (col === "skip") return t.status === "skip";
  const active = t.status !== "done" && t.status !== "skip";
  if (col === "open") return active && t.date === null; // unscheduled inbox
  return active && t.date !== null; // todo = scheduled
};

export function BoardPage() {
  const tasks = useStore((s) => s.tasks);
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const updateTask = useStore((s) => s.updateTask);
  const addTask = useStore((s) => s.addTask);
  const [selected, setSelected] = useState<Task | null>(null);
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<ColId | null>(null);
  const { filters, setFilters, match, active, clear } = useTaskFilter();

  const hueOf = (vId: string | null) =>
    values.find((v) => v.id === vId)?.hue ?? "var(--color-mist)";
  const goalName = (gId: string | null) => goals.find((g) => g.id === gId)?.name ?? null;
  const staleCutoff = format(subDays(new Date(), 7), "yyyy-MM-dd");

  const drop = (col: ColId) => {
    const t = dragId ? tasks.find((x) => x.id === dragId) : null;
    if (!t) { setDragId(null); setOver(null); return; }
    let patch: Partial<Task>;
    if (col === "open") patch = { date: null, time: null, status: "open" };
    else if (col === "done") patch = { status: "done" };
    else if (col === "skip") patch = { status: "skip" };
    else patch = { status: "todo", date: t.date ?? todayISO() };
    updateTask(t.id, patch);
    setDragId(null);
    setOver(null);
  };

  const add = (col: ColId) => {
    const t = addTask(
      col === "open"
        ? { title: "New task" } // undated → defaults to "open"
        : { title: "New task", date: todayISO(), status: col === "done" ? "done" : col === "skip" ? "skip" : "todo" },
    );
    setSelected(t);
  };

  return (
    <div className="mx-auto max-w-[1400px] p-4">
      <Panel className="mb-4 px-5 py-4">
        <Label>// board · status</Label>
        <h1 className="display mt-1 text-3xl">Everything, by status</h1>
        <p className="mono mt-1 text-[11px] text-stone">
          Drag between columns. Open holds unscheduled tasks; give one a date and it moves to To do.
        </p>
      </Panel>

      <TaskFilterBar filters={filters} onChange={setFilters} onClear={clear} active={active} />

      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => {
          const all = tasks
            .filter((t) => inColumn(t, col.id))
            .filter(match)
            // keep "To do" actionable: drop stale misses older than a week (still counted in analytics)
            .filter((t) => !(col.id === "todo" && t.date !== null && t.date < staleCutoff))
            .sort((a, b) => {
              const cmp = (a.date ?? "9999").localeCompare(b.date ?? "9999") || a.order - b.order;
              return col.id === "done" ? -cmp : cmp; // Done shows most-recent first
            });
          const list = all.slice(0, COLUMN_LIMIT);
          const hidden = all.length - list.length;
          return (
            <div
              key={col.id}
              onDragOver={(e) => { e.preventDefault(); setOver(col.id); }}
              onDragLeave={() => setOver((o) => (o === col.id ? null : o))}
              onDrop={() => drop(col.id)}
              className={cx(
                "surface flex min-h-[60vh] flex-col border p-2 transition-colors",
                over === col.id ? "border-ink bg-paper-3" : "border-[var(--color-line)]",
              )}
            >
              <div className="mb-2 flex items-center justify-between px-1 pt-1">
                <div>
                  <span className="display text-sm">{col.label}</span>
                  <Label className="ml-2">{col.sub}</Label>
                </div>
                <span className="mono flex items-center gap-2 text-[11px] text-stone">
                  {all.length}
                  <button onClick={() => add(col.id)} aria-label={`Add to ${col.label}`} className="hover:text-ink">
                    <Icon name="plus" size={14} />
                  </button>
                </span>
              </div>

              <div className="flex flex-1 flex-col gap-2 overflow-y-auto">
                {list.map((t) => (
                  <article
                    key={t.id}
                    draggable
                    onDragStart={() => setDragId(t.id)}
                    onDragEnd={() => setDragId(null)}
                    onClick={() => setSelected(t)}
                    className={cx(
                      "group cursor-grab border-l-2 bg-paper p-2.5 transition-shadow hover:shadow-[0_1px_0_var(--color-line-strong)] active:cursor-grabbing",
                      dragId === t.id && "opacity-40",
                    )}
                    style={{ borderColor: hueOf(t.valueId) }}
                  >
                    <div className="flex items-start gap-2">
                      <Icon name="drag" size={13} className="mt-0.5 shrink-0 text-fog group-hover:text-stone" />
                      <p className={cx("flex-1 text-[12px] leading-snug", (t.status === "done" || t.status === "skip") && "text-stone line-through")}>
                        {t.title}
                      </p>
                    </div>
                    {/* hierarchy: value (left border) → goal → habit (errand only when unaligned) */}
                    <div className="mt-2 flex flex-wrap items-center gap-1.5 pl-5">
                      {goalName(t.goalId) && <Tag>→ {goalName(t.goalId)}</Tag>}
                      {t.kind === "habit" && <Tag>HABIT</Tag>}
                      {!t.valueId && !t.goalId && <Tag>ERRAND</Tag>}
                      {t.date && <span className="mono text-[9px] text-mist">{fmtShort(t.date)}{t.time ? ` · ${t.time}` : ""}</span>}
                    </div>
                  </article>
                ))}
                {!list.length && (
                  <button onClick={() => add(col.id)} className="mono mt-1 border border-dashed border-[var(--color-line)] py-6 text-center text-[10px] uppercase tracking-[0.1em] text-mist hover:border-ink hover:text-ink">
                    + add
                  </button>
                )}
                {hidden > 0 && (
                  <p className="mono py-2 text-center text-[10px] uppercase tracking-[0.1em] text-mist">
                    + {hidden} more {col.id === "done" ? "older" : ""}
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <TaskDrawer task={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
