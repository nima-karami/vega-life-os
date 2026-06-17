import { addDays } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import { addMinutes, fmtShort, minutesOf, weekDays, weekStartOf } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { Button, ContextMenu, cx, Icon, IconButton, Label, Panel } from "@/core/ui";
import type { Task } from "@/features/tasks";
import { TaskDrawer } from "@/features/tasks";

const START = 5 * 60;
const END = 23 * 60;
const HOUR_PX = 46;
const GUTTER = 52;
const SNAP = 15;
const HOURS = Array.from({ length: (END - START) / 60 + 1 }, (_, i) => 5 + i);

const fmtMin = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const snap = (m: number) => Math.round(m / SNAP) * SNAP;

type DragMode = "move" | "top" | "bottom";
interface DragState {
  id: string;
  mode: DragMode;
  origDate: string;
  origStart: number;
  origDur: number;
  grabMin: number; // offset from block top to pointer, at grab time
  moved: boolean;
}
interface Preview {
  date: string;
  start: number;
  durationMin: number;
}

export function CalendarPage() {
  const tasks = useStore((s) => s.tasks);
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const planWeek = useStore((s) => s.planWeek);
  const updateTask = useStore((s) => s.updateTask);
  const addTask = useStore((s) => s.addTask);
  const removeTask = useStore((s) => s.removeTask);
  const duplicateTask = useStore((s) => s.duplicateTask);
  const clipboardTask = useStore((s) => s.clipboardTask);
  const copyTask = useStore((s) => s.copyTask);
  const clearClipboard = useStore((s) => s.clearClipboard);
  const pushToast = useStore((s) => s.pushToast);
  const focusGoalId = useStore((s) => s.focusGoalId);
  const setFocusGoal = useStore((s) => s.setFocusGoal);

  const [weekRef, setWeekRef] = useState(() => new Date());
  const [selected, setSelected] = useState<Task | null>(null);

  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const previewRef = useRef<Preview | null>(null);
  const justDragged = useRef(false);
  // selecting "Copy" can let the menu-close click fall through to the column; ignore
  // column clicks for a brief window after arming so it doesn't paste immediately.
  const pasteSuppressUntil = useRef(0);
  const [dragId, setDragId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  // mirror clipboard into a ref so the window pointerup handler reads the latest value
  const clipRef = useRef(clipboardTask);
  clipRef.current = clipboardTask;

  // Esc disarms a pending paste
  useEffect(() => {
    if (!clipboardTask) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearClipboard();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clipboardTask, clearClipboard]);

  // snapped start minutes for a clientY inside the grid
  const minuteAt = (clientY: number) => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return START;
    const m = snap(START + ((clientY - rect.top) / HOUR_PX) * 60);
    return Math.max(START, Math.min(END - SNAP, m));
  };

  // paste content into a target card (replace), keeping its id/date/time/status
  const replaceWith = (id: string, c: NonNullable<typeof clipboardTask>) => {
    updateTask(id, {
      title: c.title,
      valueId: c.valueId,
      goalId: c.goalId,
      energy: c.energy,
      durationMin: c.durationMin,
      note: c.note,
    });
    pushToast("Replaced from clipboard");
  };

  // click on an empty part of a day column: paste (if armed) or create a new task
  const onColumnClick = (e: React.MouseEvent, dayIso: string) => {
    if (justDragged.current) return;
    if (Date.now() < pasteSuppressUntil.current) return; // ignore the menu-close fall-through
    if ((e.target as HTMLElement).closest("[data-block]")) return; // clicked a card, not empty space
    const time = fmtMin(minuteAt(e.clientY));
    const c = clipRef.current;
    if (c) {
      duplicateTask(c, { date: dayIso, time });
      pushToast("Pasted");
    } else {
      const t = addTask({ title: "New task", date: dayIso, time, durationMin: 60, status: "todo" });
      setSelected(t);
    }
  };

  const days = useMemo(() => weekDays(weekRef), [weekRef]);
  const hueOf = (vId: string | null) =>
    values.find((v) => v.id === vId)?.hue ?? "var(--color-mist)";

  // commit a schedule change; a moved/resized habit instance detaches from its template
  const commit = (id: string, patch: Partial<Task>) => {
    const t = tasks.find((x) => x.id === id);
    if (t?.kind === "habit") patch = { ...patch, detached: true };
    updateTask(id, patch);
  };

  const beginDrag = (e: React.PointerEvent, t: Task, mode: DragMode) => {
    if (e.button !== 0) return; // left-button only — right-click is for the context menu
    if (!gridRef.current || !t.time || !t.date) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = gridRef.current.getBoundingClientRect();
    const pointerMin = START + ((e.clientY - rect.top) / HOUR_PX) * 60;
    const origStart = minutesOf(t.time);
    dragRef.current = {
      id: t.id,
      mode,
      origDate: t.date,
      origStart,
      origDur: t.durationMin,
      grabMin: pointerMin - origStart,
      moved: false,
    };
    const p = { date: t.date, start: origStart, durationMin: t.durationMin };
    previewRef.current = p;
    setPreview(p);
    setDragId(t.id);
  };

  // mirror the latest task list and mutators into refs so the window pointerup
  // handler reads current values without re-subscribing on every render
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const replaceWithRef = useRef(replaceWith);
  replaceWithRef.current = replaceWith;

  // pointer-driven move/resize with live preview; window listeners so the drag
  // keeps tracking even when the cursor leaves the column.
  useEffect(() => {
    if (!dragId) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      const grid = gridRef.current;
      if (!d || !grid) return;
      const rect = grid.getBoundingClientRect();
      const pointerMin = START + ((e.clientY - rect.top) / HOUR_PX) * 60;
      let next: Preview;
      if (d.mode === "move") {
        const colW = (rect.width - GUTTER) / 7;
        let dayIdx = Math.floor((e.clientX - rect.left - GUTTER) / colW);
        dayIdx = Math.max(0, Math.min(6, dayIdx));
        let start = snap(pointerMin - d.grabMin);
        start = Math.max(START, Math.min(END - d.origDur, start));
        next = { date: days[dayIdx].iso, start, durationMin: d.origDur };
      } else if (d.mode === "bottom") {
        let end = snap(pointerMin);
        end = Math.max(d.origStart + SNAP, Math.min(END, end));
        next = { date: d.origDate, start: d.origStart, durationMin: end - d.origStart };
      } else {
        let start = snap(pointerMin);
        start = Math.max(START, Math.min(d.origStart + d.origDur - SNAP, start));
        next = { date: d.origDate, start, durationMin: d.origStart + d.origDur - start };
      }
      d.moved = true;
      previewRef.current = next;
      setPreview(next);
    };
    const onUp = () => {
      const d = dragRef.current;
      const p = previewRef.current;
      if (d && p) {
        const changed =
          p.date !== d.origDate || p.start !== d.origStart || p.durationMin !== d.origDur;
        if (changed) {
          commitRef.current(d.id, {
            date: p.date,
            time: fmtMin(p.start),
            durationMin: p.durationMin,
          });
          justDragged.current = true;
          setTimeout(() => {
            justDragged.current = false;
          }, 0);
        } else if (d.mode === "move" && !d.moved) {
          // a tap: paste-replace if armed, otherwise open the task
          if (clipRef.current) replaceWithRef.current(d.id, clipRef.current);
          else {
            const t = tasksRef.current.find((x) => x.id === d.id);
            if (t) setSelected(t);
          }
        }
      }
      dragRef.current = null;
      previewRef.current = null;
      setDragId(null);
      setPreview(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId, days]);

  const generateWeek = () => {
    const made = planWeek(weekRef);
    pushToast(made ? `Generated ${made} habit blocks` : "Week already complete");
  };

  // effective position of a task (preview overrides while dragging it)
  const effective = (t: Task) =>
    dragId === t.id && preview
      ? { date: preview.date, start: preview.start, durationMin: preview.durationMin }
      : { date: t.date ?? "", start: minutesOf(t.time ?? ""), durationMin: t.durationMin };

  return (
    <div className="mx-auto max-w-[1400px] p-4">
      <Panel className="mb-4 flex flex-wrap items-center gap-4 px-5 py-4">
        <div>
          <Label>// calendar · week</Label>
          <h1 className="display mt-1 text-3xl">
            {fmtShort(days[0].iso)} – {fmtShort(days[6].iso)}
          </h1>
          <p className="mono mt-1 text-[11px] text-stone">habit instances + scheduled tasks</p>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <IconButton
            name="chevL"
            label="Previous week"
            onClick={() => setWeekRef(addDays(weekStartOf(weekRef), -7))}
          />
          <Button onClick={() => setWeekRef(new Date())}>Today</Button>
          <IconButton
            name="chevR"
            label="Next week"
            onClick={() => setWeekRef(addDays(weekStartOf(weekRef), 7))}
          />
          <Button solid icon="flash" onClick={generateWeek}>
            Generate week
          </Button>
        </div>
      </Panel>

      {/* focus filter */}
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <Label>focus</Label>
        <button
          type="button"
          onClick={() => setFocusGoal(null)}
          className={cx(
            "mono border px-2.5 py-1 text-[10px] uppercase tracking-[0.1em]",
            !focusGoalId
              ? "border-ink bg-ink text-paper"
              : "surface border-[var(--color-line)] text-stone",
          )}
        >
          All
        </button>
        {goals.map((g) => (
          <button
            type="button"
            key={g.id}
            onClick={() => setFocusGoal(focusGoalId === g.id ? null : g.id)}
            className={cx(
              "mono flex items-center gap-1.5 border px-2.5 py-1 text-[10px] uppercase tracking-[0.08em]",
              focusGoalId === g.id
                ? "border-ink bg-ink text-paper"
                : "surface border-[var(--color-line)] text-stone",
            )}
          >
            <span className="h-2 w-2 rounded-full" style={{ background: hueOf(g.valueId) }} />
            {g.name}
          </button>
        ))}
      </div>

      {clipboardTask && (
        <Panel className="mb-3 flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-2.5">
          <Icon name="clipboard" size={15} className="text-ink" />
          <span className="mono text-[11px] uppercase tracking-[0.1em] text-ink">
            Copied "{clipboardTask.title}"
          </span>
          <span className="mono text-[10px] text-stone">
            — click an empty slot to place it, or a card to replace
          </span>
          <button
            type="button"
            onClick={clearClipboard}
            className="mono ml-auto flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] text-stone hover:text-signal"
          >
            <Icon name="close" size={12} /> cancel · esc
          </button>
        </Panel>
      )}

      <Panel className="overflow-hidden">
        <div className="overflow-x-auto">
          <div className="min-w-[720px]">
            {/* day headers */}
            <div
              className="grid border-b border-[var(--color-line)]"
              style={{ gridTemplateColumns: `${GUTTER}px repeat(7, 1fr)` }}
            >
              <div />
              {days.map((d) => (
                <div
                  key={d.iso}
                  className={cx(
                    "border-l border-[var(--color-line)] px-2 py-2",
                    d.today && "bg-paper-3",
                  )}
                >
                  <span className="mono text-[10px] uppercase tracking-[0.1em] text-stone">
                    {d.dow}
                  </span>
                  <span className={cx("display ml-1.5 text-lg", d.today && "text-ink")}>
                    {String(d.dom).padStart(2, "0")}
                  </span>
                  {d.today && (
                    <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-signal align-middle" />
                  )}
                </div>
              ))}
            </div>

            {/* grid body */}
            <div className="relative overflow-y-auto" style={{ maxHeight: "calc(100vh - 320px)" }}>
              <div
                ref={gridRef}
                className={cx("grid", dragId && "select-none")}
                style={{
                  gridTemplateColumns: `${GUTTER}px repeat(7, 1fr)`,
                  height: HOURS.length * HOUR_PX,
                }}
              >
                {/* hour gutter */}
                <div className="relative">
                  {HOURS.map((h, i) => (
                    <div key={h} className="absolute right-1.5" style={{ top: i * HOUR_PX - 5 }}>
                      <span className="mono text-[9px] tabular-nums text-mist">
                        {String(h).padStart(2, "0")}:00
                      </span>
                    </div>
                  ))}
                </div>

                {/* day columns */}
                {days.map((d) => {
                  const dayTasks = tasks.filter((t) => t.time && effective(t).date === d.iso);
                  const isTarget = dragId != null && preview?.date === d.iso;
                  return (
                    <div
                      key={d.iso}
                      className={cx(
                        "relative border-l border-[var(--color-line)]",
                        d.today && "bg-paper-2/40",
                        isTarget && "bg-paper-3",
                      )}
                    >
                      {/* click surface: empty-space clicks create/paste a task at that time */}
                      <button
                        type="button"
                        aria-label={`Add task on ${d.iso}`}
                        onClick={(e) => onColumnClick(e, d.iso)}
                        className={cx(
                          "absolute inset-0 z-0 block w-full",
                          clipboardTask ? "cursor-copy" : "cursor-default",
                        )}
                      />
                      {/* hour lines */}
                      {HOURS.map((h, i) => (
                        <div
                          key={h}
                          className="pointer-events-none absolute left-0 right-0 border-t border-[var(--color-line-soft)]"
                          style={{ top: i * HOUR_PX }}
                        />
                      ))}
                      {/* now line */}
                      {d.today && <NowLine />}
                      {/* live drop guide — sits above the dragged card (z-40) so the time is always legible */}
                      {isTarget && preview && (
                        <div
                          className="pointer-events-none absolute inset-x-0 z-40 flex items-center gap-1"
                          style={{ top: ((preview.start - START) / 60) * HOUR_PX }}
                        >
                          <span className="mono -translate-y-1/2 rounded-[2px] bg-ink px-1.5 py-0.5 text-[9px] tabular-nums leading-none text-paper shadow-[0_1px_4px_rgba(24,24,15,0.4)]">
                            {fmtMin(preview.start)}–
                            {addMinutes(fmtMin(preview.start), preview.durationMin)}
                          </span>
                          <span className="h-px flex-1 bg-ink" />
                        </div>
                      )}
                      {/* task blocks */}
                      {dayTasks.map((t) => {
                        const eff = effective(t);
                        const top = ((eff.start - START) / 60) * HOUR_PX;
                        const height = Math.max((eff.durationMin / 60) * HOUR_PX - 2, 20);
                        const resolved = t.status === "done" || t.status === "skip";
                        const dim = focusGoalId && t.goalId !== focusGoalId;
                        const dragging = dragId === t.id;
                        return (
                          <ContextMenu
                            key={t.id}
                            items={[
                              {
                                label: "Copy",
                                icon: "copy",
                                onSelect: () => {
                                  copyTask(t);
                                  pasteSuppressUntil.current = Date.now() + 400;
                                  pushToast("Copied — click a slot or card to paste");
                                },
                              },
                              {
                                label: "Delete",
                                icon: "trash",
                                danger: true,
                                onSelect: () => {
                                  removeTask(t.id);
                                  pushToast("Task deleted");
                                },
                              },
                            ]}
                          >
                            <button
                              type="button"
                              data-block
                              onPointerDown={(e) => beginDrag(e, t, "move")}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") setSelected(t);
                              }}
                              className={cx(
                                "group absolute left-0.5 right-0.5 block cursor-grab touch-none select-none overflow-hidden border-l-2 px-1.5 py-1 text-left",
                                resolved ? "bg-paper-3" : "bg-paper",
                                dim ? "opacity-25" : "opacity-100",
                                dragging
                                  ? "z-30 cursor-grabbing shadow-[0_4px_16px_rgba(24,24,15,0.25)] ring-1 ring-ink"
                                  : "transition-[top,height] duration-75",
                              )}
                              style={{
                                top,
                                height,
                                borderColor: hueOf(t.valueId),
                                boxShadow: dragging ? undefined : "0 1px 0 var(--color-line)",
                              }}
                            >
                              {/* top resize handle */}
                              <span
                                onPointerDown={(e) => beginDrag(e, t, "top")}
                                className="absolute inset-x-0 top-0 z-10 h-1.5 cursor-ns-resize opacity-0 group-hover:opacity-100"
                              />
                              <span
                                className={cx(
                                  "mono block truncate text-[10px] leading-tight",
                                  resolved && "line-through",
                                )}
                              >
                                {t.title}
                              </span>
                              {height > 34 && (
                                <span className="mono mt-0.5 block text-[8px] text-stone">
                                  {dragging
                                    ? `${fmtMin(eff.start)}–${addMinutes(fmtMin(eff.start), eff.durationMin)}`
                                    : t.time}
                                </span>
                              )}
                              {/* bottom resize handle */}
                              <span
                                onPointerDown={(e) => beginDrag(e, t, "bottom")}
                                className="absolute inset-x-0 bottom-0 z-10 flex h-1.5 cursor-ns-resize items-end justify-center opacity-0 group-hover:opacity-100"
                              >
                                <span className="mb-px h-0.5 w-5 rounded-full bg-ink/40" />
                              </span>
                            </button>
                          </ContextMenu>
                        );
                      })}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1.5">
        <Icon name="plus" size={13} className="text-stone" />
        <span className="mono text-[10px] text-stone">Click an empty slot to add a task</span>
        <Icon name="drag" size={13} className="ml-3 text-stone" />
        <span className="mono text-[10px] text-stone">
          Drag to move · drag a top/bottom edge to resize
        </span>
        <Icon name="copy" size={12} className="ml-3 text-stone" />
        <span className="mono text-[10px] text-stone">
          Right-click a card to copy, then click to paste
        </span>
      </div>

      <TaskDrawer
        task={selected ? (tasks.find((t) => t.id === selected.id) ?? null) : null}
        onClose={() => setSelected(null)}
      />
    </div>
  );
}

function NowLine() {
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  if (cur < START || cur > END) return null;
  const top = ((cur - START) / 60) * HOUR_PX;
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-10 flex items-center"
      style={{ top }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-signal" />
      <span className="h-px flex-1 bg-signal" />
    </div>
  );
}
