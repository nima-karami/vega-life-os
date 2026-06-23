import { Button, Card, Chip, Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/react";
import { addDays } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRegisterCommands } from "@/app/commands";
import { addMinutes, fmtShort, minutesOf, weekDays, weekStartOf } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { ContextMenu, cx, FloatingMenu, Icon, type MenuItem, TimePicker } from "@/core/ui";
import type { Task } from "@/features/tasks";
import { TaskDrawer } from "@/features/tasks";
import { useValueColor } from "@/features/values";
import { CalendarSync } from "./CalendarSync";
import {
  chipHeight,
  chipTop,
  DAY_END,
  DAY_START,
  DROP_DURATION,
  type DragMode,
  dropToSchedule,
  fmtMin,
  GUTTER,
  HOUR_PX,
  HOURS,
  isOffWindow,
  minuteAtOffset,
  resolveDrag,
} from "./geometry";
import { timedTasksForDay, unscheduledTasks, untimedTasksForDay } from "./grid-data";

interface DragState {
  id: string;
  /** "schedule" = an all-day chip being dragged onto the timed grid. */
  mode: DragMode | "schedule";
  origDate: string;
  origStart: number;
  origDur: number;
  grabMin: number;
  moved: boolean;
  /** pointer origin for the all-day drag threshold (schedule mode only). */
  startX: number;
  startY: number;
}
interface Preview {
  date: string;
  start: number;
  durationMin: number;
}

const MOBILE_QUERY = "(max-width: 639px)";

export function CalendarPage() {
  const tasks = useStore((s) => s.tasks);
  const goals = useStore((s) => s.goals);
  const habits = useStore((s) => s.habits);
  const updateTask = useStore((s) => s.updateTask);
  const relinkTaskToHabit = useStore((s) => s.relinkTaskToHabit);
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
  // Right-click menu for an empty slot, and the "schedule existing task" picker.
  const [slotMenu, setSlotMenu] = useState<{
    x: number;
    y: number;
    date: string;
    time: string;
  } | null>(null);
  const [scheduleSlot, setScheduleSlot] = useState<{ date: string; time: string } | null>(null);
  // "Schedule to time…" — the keyboard path that gives an all-day chip a time.
  const [scheduleTask, setScheduleTask] = useState<Task | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const [announce, setAnnounce] = useState("");
  const [mobile, setMobile] = useState(
    () => typeof window !== "undefined" && window.matchMedia(MOBILE_QUERY).matches,
  );
  const [activeDay, setActiveDay] = useState(0); // mobile single-day index 0..6

  const gridRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const previewRef = useRef<Preview | null>(null);
  // Id of a task freshly created by clicking an empty slot — discarded on close
  // if it was never named (so an accidental click doesn't litter the calendar).
  const draftIdRef = useRef<string | null>(null);
  const justDragged = useRef(false);
  const pasteSuppressUntil = useRef(0);
  const [dragId, setDragId] = useState<string | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);

  const clipRef = useRef(clipboardTask);
  clipRef.current = clipboardTask;

  const days = useMemo(() => weekDays(weekRef), [weekRef]);

  // Per-view commands (calendar is reachable via the command bar; these add actions).
  useRegisterCommands([
    {
      id: "cal-today",
      label: "Calendar: Go to today",
      icon: "calendar",
      keywords: "calendar today week",
      run: ({ close }) => {
        if (dragRef.current) cancelDrag();
        setWeekRef(new Date());
        close();
      },
    },
  ]);

  // Track the mobile breakpoint so the wide grid degrades to a single day.
  useEffect(() => {
    const mql = window.matchMedia(MOBILE_QUERY);
    const onChange = () => setMobile(mql.matches);
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  // Keep the active mobile day on today when the week contains it.
  useEffect(() => {
    const todayIdx = days.findIndex((d) => d.today);
    if (todayIdx >= 0) setActiveDay(todayIdx);
  }, [days]);

  // Esc disarms a pending paste.
  useEffect(() => {
    if (!clipboardTask) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") clearClipboard();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [clipboardTask, clearClipboard]);

  const minuteAt = (clientY: number) => {
    const rect = gridRef.current?.getBoundingClientRect();
    if (!rect) return DAY_START;
    return minuteAtOffset(clientY - rect.top);
  };

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

  // Open an existing task. Clears any pending draft so it isn't discarded.
  const openTask = (t: Task) => {
    draftIdRef.current = null;
    setSelected(t);
  };

  // Close the editor; if a freshly-created draft was never named, discard it.
  const closeEditor = () => {
    const id = draftIdRef.current;
    draftIdRef.current = null;
    if (id) {
      const t = tasks.find((x) => x.id === id);
      if (t && (t.title.trim() === "" || t.title === "New task")) removeTask(id);
    }
    setSelected(null);
  };

  // Create a fresh task at a slot and open it as a draft (discarded if unnamed).
  const createDraftAt = (date: string, time: string) => {
    const t = addTask({ title: "New task", date, time, durationMin: 60, status: "todo" });
    draftIdRef.current = t.id;
    setSelected(t);
    setAnnounce(`Created task on ${date} at ${time}`);
  };

  // Paste the clipboard task into a slot.
  const pasteAt = (date: string, time: string) => {
    const c = clipRef.current;
    if (!c) return;
    duplicateTask(c, { date, time });
    pushToast("Pasted");
    setAnnounce("Pasted task");
  };

  // Schedule an existing (unscheduled) task into a slot.
  const scheduleAt = (t: Task, date: string, time: string) => {
    updateTask(t.id, { date, time, status: "todo" });
    pushToast(`Scheduled "${t.title}"`);
    setAnnounce(`Scheduled ${t.title} on ${date}`);
  };

  const onColumnClick = (e: React.MouseEvent, dayIso: string) => {
    if (justDragged.current) return;
    if (Date.now() < pasteSuppressUntil.current) return;
    if ((e.target as HTMLElement).closest("[data-block]")) return;
    const time = fmtMin(minuteAt(e.clientY));
    if (clipRef.current) pasteAt(dayIso, time);
    else createDraftAt(dayIso, time);
  };

  // Right-click an empty slot → menu (add / paste / schedule existing).
  const onColumnContextMenu = (e: React.MouseEvent, dayIso: string) => {
    if ((e.target as HTMLElement).closest("[data-block]")) return;
    e.preventDefault();
    setSlotMenu({ x: e.clientX, y: e.clientY, date: dayIso, time: fmtMin(minuteAt(e.clientY)) });
  };

  // commit a schedule change; a moved/resized habit instance detaches.
  const commit = (id: string, patch: Partial<Task>) => {
    const t = tasks.find((x) => x.id === id);
    try {
      if (t?.kind === "habit") updateTask(id, { ...patch, detached: true });
      else updateTask(id, patch);
    } catch {
      pushToast("Couldn’t save that change");
      setAnnounce("Couldn’t save that change");
    }
  };

  const beginDrag = (e: React.PointerEvent, t: Task, mode: DragMode) => {
    if (e.button !== 0) return;
    if (!gridRef.current || !t.time || !t.date) return;
    e.preventDefault();
    e.stopPropagation();
    const rect = gridRef.current.getBoundingClientRect();
    const pointerMin = DAY_START + ((e.clientY - rect.top) / HOUR_PX) * 60;
    const origStart = minutesOf(t.time);
    dragRef.current = {
      id: t.id,
      mode,
      origDate: t.date,
      origStart,
      origDur: t.durationMin,
      grabMin: pointerMin - origStart,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
    };
    const p = { date: t.date, start: origStart, durationMin: t.durationMin };
    previewRef.current = p;
    setPreview(p);
    setDragId(t.id);
  };

  // Begin dragging an all-day chip onto the timed grid (drag-to-schedule).
  const beginScheduleDrag = (e: React.PointerEvent, t: Task) => {
    if (e.button !== 0) return;
    if (!gridRef.current || !t.date) return;
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = {
      id: t.id,
      mode: "schedule",
      origDate: t.date,
      origStart: 0,
      origDur: DROP_DURATION,
      grabMin: 0,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
    };
    const p = { date: t.date, start: DAY_START, durationMin: DROP_DURATION };
    previewRef.current = p;
    setPreview(p);
    setDragId(t.id);
  };

  // Abandon an in-flight drag with no change (Esc / navigation).
  const cancelDrag = () => {
    dragRef.current = null;
    previewRef.current = null;
    setDragId(null);
    setPreview(null);
  };

  // Give an all-day task a time without dragging (the keyboard schedule path).
  const scheduleToTime = (t: Task, time: string) => {
    updateTask(t.id, {
      time,
      durationMin: DROP_DURATION,
      ...(t.status === "open" ? { status: "todo" as const } : {}),
    });
    pushToast(`Scheduled "${t.title}"`);
    setAnnounce(`Scheduled ${t.title} at ${time}`);
  };

  // The relink action for a task's context menu, or null when relink doesn't apply.
  const relinkItemFor = (t: Task): MenuItem | null => {
    if (t.kind !== "habit" || !t.detached) return null;
    const exists = t.habitId != null && habits.some((h) => h.id === t.habitId);
    return {
      label: exists ? "Relink to habit" : "Parent habit no longer exists",
      icon: "link",
      disabled: !exists,
      onSelect: () => {
        relinkTaskToHabit(t.id);
        pushToast("Relinked to habit");
        setAnnounce("Relinked to habit");
      },
    };
  };

  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const commitRef = useRef(commit);
  commitRef.current = commit;
  const replaceWithRef = useRef(replaceWith);
  replaceWithRef.current = replaceWith;

  // Resolve a drag release: commit a real change, or treat a no-move as a tap.
  const endDrag = (d: DragState, p: Preview) => {
    if (d.mode === "schedule") {
      const t = tasksRef.current.find((x) => x.id === d.id);
      if (!d.moved) {
        if (t) openTask(t); // a tap on an all-day chip still opens it
        return;
      }
      commitRef.current(d.id, {
        date: p.date,
        time: fmtMin(p.start),
        durationMin: DROP_DURATION,
        ...(t?.status === "open" ? { status: "todo" } : {}),
      });
      setAnnounce(
        `Scheduled ${t?.title ?? "task"} on ${p.date}, ${fmtMin(p.start)}–${addMinutes(fmtMin(p.start), DROP_DURATION)}`,
      );
      justDragged.current = true;
      setTimeout(() => {
        justDragged.current = false;
      }, 0);
      return;
    }
    const changed = p.date !== d.origDate || p.start !== d.origStart || p.durationMin !== d.origDur;
    if (changed) {
      commitRef.current(d.id, { date: p.date, time: fmtMin(p.start), durationMin: p.durationMin });
      setAnnounce(
        `Moved to ${p.date}, ${fmtMin(p.start)}–${addMinutes(fmtMin(p.start), p.durationMin)}`,
      );
      justDragged.current = true;
      setTimeout(() => {
        justDragged.current = false;
      }, 0);
      return;
    }
    // a tap (no movement): paste-replace if armed, else open the task
    if (d.mode !== "move" || d.moved) return;
    if (clipRef.current) {
      replaceWithRef.current(d.id, clipRef.current);
      return;
    }
    const t = tasksRef.current.find((x) => x.id === d.id);
    if (t) openTask(t);
  };
  const endDragRef = useRef(endDrag);
  endDragRef.current = endDrag;

  // columns the move-drag can land on (mobile = just the active day)
  const dragDays = mobile ? [days[activeDay]] : days;
  const dragDaysRef = useRef(dragDays);
  dragDaysRef.current = dragDays;

  useEffect(() => {
    if (!dragId) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      const grid = gridRef.current;
      if (!d || !grid) return;
      const rect = grid.getBoundingClientRect();
      const cols = dragDaysRef.current;
      const colW = (rect.width - GUTTER) / cols.length;
      let dayIdx = Math.floor((e.clientX - rect.left - GUTTER) / colW);
      dayIdx = Math.max(0, Math.min(cols.length - 1, dayIdx));

      if (d.mode === "schedule") {
        // ignore sub-threshold jitter so a tap still opens the chip
        if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < 4) return;
        d.moved = true;
        const { startMin } = dropToSchedule(e.clientY - rect.top);
        const next = { date: cols[dayIdx].iso, start: startMin, durationMin: DROP_DURATION };
        previewRef.current = next;
        setPreview(next);
        return;
      }

      const pointerMin = DAY_START + ((e.clientY - rect.top) / HOUR_PX) * 60;
      const next = resolveDrag(
        d.mode,
        { origDate: d.origDate, origStart: d.origStart, origDur: d.origDur },
        { pointerMin, grabMin: d.grabMin, targetDate: cols[dayIdx].iso },
      );
      d.moved = true;
      previewRef.current = next;
      setPreview(next);
    };
    const onUp = () => {
      const d = dragRef.current;
      const p = previewRef.current;
      if (d && p) endDragRef.current(d, p);
      dragRef.current = null;
      previewRef.current = null;
      setDragId(null);
      setPreview(null);
    };
    // Esc abandons the gesture with no change.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      dragRef.current = null;
      previewRef.current = null;
      setDragId(null);
      setPreview(null);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp, { once: true });
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("keydown", onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dragId]);

  const effective = (t: Task) =>
    dragId === t.id && preview
      ? { date: preview.date, start: preview.start, durationMin: preview.durationMin }
      : { date: t.date ?? "", start: minutesOf(t.time ?? "00:00"), durationMin: t.durationMin };

  // The chip currently dragged, and whether it's an all-day → grid schedule drag.
  const dragTask = dragId ? tasks.find((t) => t.id === dragId) : null;
  const scheduleDragging = dragTask != null && dragTask.time == null;

  const copyToClipboard = (t: Task) => {
    copyTask(t);
    pasteSuppressUntil.current = Date.now() + 400;
    pushToast("Copied — click a slot or chip to paste");
  };
  const deleteTask = (t: Task) => {
    removeTask(t.id);
    pushToast("Task deleted");
  };

  // Shared chip menus. Timed chips: Copy · Delete · (Relink). All-day chips also
  // get Open and "Schedule to time…" (the keyboard path for drag-to-schedule).
  const timedMenuItems = (t: Task): MenuItem[] => {
    const relink = relinkItemFor(t);
    return [
      { label: "Copy", icon: "copy", onSelect: () => copyToClipboard(t) },
      { label: "Delete", icon: "trash", danger: true, onSelect: () => deleteTask(t) },
      ...(relink ? [relink] : []),
    ];
  };
  const allDayMenuItems = (t: Task): MenuItem[] => {
    const relink = relinkItemFor(t);
    return [
      { label: "Open", icon: "edit", onSelect: () => openTask(t) },
      { label: "Copy", icon: "copy", onSelect: () => copyToClipboard(t) },
      { label: "Delete", icon: "trash", danger: true, onSelect: () => deleteTask(t) },
      { label: "Schedule to time…", icon: "clock", onSelect: () => setScheduleTask(t) },
      ...(relink ? [relink] : []),
    ];
  };

  const gotoPrev = () => {
    if (dragRef.current) cancelDrag();
    if (mobile) {
      if (activeDay > 0) setActiveDay((i) => i - 1);
      else {
        setWeekRef(addDays(weekStartOf(weekRef), -7));
        setActiveDay(6);
      }
    } else {
      setWeekRef(addDays(weekStartOf(weekRef), -7));
    }
  };
  const gotoNext = () => {
    if (dragRef.current) cancelDrag();
    if (mobile) {
      if (activeDay < 6) setActiveDay((i) => i + 1);
      else {
        setWeekRef(addDays(weekStartOf(weekRef), 7));
        setActiveDay(0);
      }
    } else {
      setWeekRef(addDays(weekStartOf(weekRef), 7));
    }
  };
  const gotoToday = () => {
    if (dragRef.current) cancelDrag();
    setWeekRef(new Date());
    setAnnounce("Showing this week");
  };

  const visibleDays = mobile ? [days[activeDay]] : days;
  const backlog = useMemo(() => unscheduledTasks(tasks), [tasks]);

  // assign a backlog task to a day (non-drag keyboard/menu pathway)
  const scheduleBacklog = (t: Task, dayIso: string) => {
    updateTask(t.id, { date: dayIso, time: "09:00", status: "todo" });
    pushToast(`Scheduled "${t.title}"`);
    setAnnounce(`Scheduled ${t.title} on ${dayIso}`);
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-5">
      <span className="sr-only" role="status" aria-live="polite">
        {announce}
      </span>

      {/* ── Nav header ───────────────────────────────────────────── */}
      <Card shadow="sm" className="mb-5">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {mobile
                ? `${visibleDays[0].dow} · ${fmtShort(visibleDays[0].iso)}`
                : `${fmtShort(days[0].iso)} – ${fmtShort(days[6].iso)}`}
            </h1>
            <p className="mt-1 text-small text-default-500">Habit instances + scheduled tasks</p>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              isIconOnly
              size="sm"
              variant="light"
              aria-label={mobile ? "Previous day" : "Previous week"}
              onPress={gotoPrev}
            >
              <Icon name="chevL" size={16} />
            </Button>
            <Button
              size="sm"
              variant="flat"
              onPress={gotoToday}
              aria-current={days.some((d) => d.today) ? "date" : undefined}
            >
              Today
            </Button>
            <Button
              isIconOnly
              size="sm"
              variant="light"
              aria-label={mobile ? "Next day" : "Next week"}
              onPress={gotoNext}
            >
              <Icon name="chevR" size={16} />
            </Button>
          </div>

          <div className="w-full pt-1">
            <CalendarSync />
          </div>
        </div>
      </Card>

      {/* ── Focus filter ─────────────────────────────────────────── */}
      {goals.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-2">
          <span className="text-small text-default-500">Focus</span>
          <FilterChip active={!focusGoalId} onClick={() => setFocusGoal(null)}>
            All
          </FilterChip>
          {goals.map((g) => (
            <FilterChip
              key={g.id}
              active={focusGoalId === g.id}
              onClick={() => setFocusGoal(focusGoalId === g.id ? null : g.id)}
            >
              {g.name}
            </FilterChip>
          ))}
        </div>
      )}

      {/* ── Mobile day strip ─────────────────────────────────────── */}
      {mobile && (
        <div className="mb-4 flex gap-1.5 overflow-x-auto no-scrollbar">
          {days.map((d, i) => (
            <button
              key={d.iso}
              type="button"
              onClick={() => setActiveDay(i)}
              aria-current={i === activeDay ? "date" : undefined}
              className={cx(
                "flex min-w-[44px] flex-col items-center rounded-medium border px-2.5 py-1.5 transition-colors",
                i === activeDay
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-divider bg-content1 text-foreground",
                d.today && i !== activeDay && "ring-1 ring-primary",
              )}
            >
              <span className="text-tiny text-default-500">{d.dow}</span>
              <span className="text-small font-semibold">{String(d.dom).padStart(2, "0")}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Paste banner ─────────────────────────────────────────── */}
      {clipboardTask && (
        <Card shadow="sm" className="mb-4">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
            <Icon name="clipboard" size={15} className="text-default-500" />
            <span className="text-small text-foreground">Copied “{clipboardTask.title}”</span>
            <span className="text-small text-default-500">
              — click an empty slot to place it, or a chip to replace
            </span>
            <Button
              size="sm"
              variant="light"
              onPress={clearClipboard}
              aria-label="Cancel paste"
              startContent={<Icon name="close" size={12} />}
              className="ml-auto text-default-500"
            >
              Cancel · Esc
            </Button>
          </div>
        </Card>
      )}

      {/* ── Week grid ────────────────────────────────────────────── */}
      <Card shadow="sm" className="overflow-hidden">
        <div className="overflow-x-auto">
          <div className={mobile ? "min-w-0" : "min-w-[720px]"}>
            {/* day headers */}
            <div
              className="grid border-b border-divider"
              style={{ gridTemplateColumns: `${GUTTER}px repeat(${visibleDays.length}, 1fr)` }}
            >
              <div />
              {visibleDays.map((d) => (
                <div
                  key={d.iso}
                  className={cx("border-l border-divider px-2.5 py-2.5", d.today && "bg-content2")}
                >
                  <span className="text-tiny text-default-500">{d.dow}</span>
                  <span
                    className={cx(
                      "ml-1.5 text-lg font-semibold",
                      d.today ? "text-primary" : "text-foreground",
                    )}
                  >
                    {String(d.dom).padStart(2, "0")}
                  </span>
                  {d.today && (
                    <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-primary align-middle" />
                  )}
                </div>
              ))}
            </div>

            {/* all-day / untimed row */}
            <div
              className="grid border-b border-divider"
              style={{ gridTemplateColumns: `${GUTTER}px repeat(${visibleDays.length}, 1fr)` }}
            >
              <div className="flex items-center justify-end px-1.5 py-1">
                <span className="text-tiny text-default-400">All day</span>
              </div>
              {visibleDays.map((d) => (
                <div key={d.iso} className="min-h-[28px] space-y-1 border-l border-divider p-1">
                  {untimedTasksForDay(tasks, d.iso).map((t) => (
                    <AllDayChip
                      key={t.id}
                      task={t}
                      dragging={dragId === t.id}
                      onPointerDownBody={(e) => beginScheduleDrag(e, t)}
                      onOpen={() => openTask(t)}
                      menuItems={allDayMenuItems(t)}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* timed grid body */}
            <div className="relative overflow-y-auto" style={{ maxHeight: "calc(100vh - 360px)" }}>
              <div
                ref={gridRef}
                className={cx("grid", dragId && "select-none")}
                style={{
                  gridTemplateColumns: `${GUTTER}px repeat(${visibleDays.length}, 1fr)`,
                  height: HOURS.length * HOUR_PX,
                }}
              >
                {/* hour gutter */}
                <div className="relative">
                  {HOURS.map((h, i) => (
                    <div key={h} className="absolute right-1.5" style={{ top: i * HOUR_PX - 5 }}>
                      <span className="text-[9px] tabular-nums text-default-400">
                        {String(h).padStart(2, "0")}:00
                      </span>
                    </div>
                  ))}
                </div>

                {/* day columns */}
                {visibleDays.map((d) => {
                  const dayTasks = tasks.filter((t) => t.time && effective(t).date === d.iso);
                  const isTarget = dragId != null && preview?.date === d.iso;
                  return (
                    <div
                      key={d.iso}
                      className={cx(
                        "relative border-l border-divider",
                        d.today && "bg-content2/40",
                        isTarget && "bg-content2",
                      )}
                    >
                      <button
                        type="button"
                        aria-label={`Add task on ${d.dow}, ${fmtShort(d.iso)}${d.today ? ", today" : ""}`}
                        onClick={(e) => onColumnClick(e, d.iso)}
                        onContextMenu={(e) => onColumnContextMenu(e, d.iso)}
                        className={cx(
                          "absolute inset-0 z-0 block w-full",
                          clipboardTask ? "cursor-copy" : "cursor-default",
                        )}
                      />
                      {HOURS.map((h, i) => (
                        <div
                          key={h}
                          className="pointer-events-none absolute left-0 right-0 border-t border-divider/60"
                          style={{ top: i * HOUR_PX }}
                        />
                      ))}
                      {d.today && <NowLine />}
                      {isTarget && preview && scheduleDragging && (
                        <div
                          className="pointer-events-none absolute inset-x-0.5 z-30 overflow-hidden rounded-[2px] border-l-[3px] border-primary bg-content1/80 px-1.5 py-1 shadow-medium ring-1 ring-primary"
                          style={{
                            top: chipTop(preview.start),
                            height: chipHeight(preview.durationMin),
                          }}
                        >
                          <span className="block truncate text-[11px] leading-tight text-foreground">
                            {dragTask?.title}
                          </span>
                        </div>
                      )}
                      {isTarget && preview && (
                        <div
                          className="pointer-events-none absolute inset-x-0 z-40 flex items-center gap-1"
                          style={{ top: chipTop(preview.start) }}
                        >
                          <span className="-translate-y-1/2 rounded-medium bg-foreground px-1.5 py-0.5 text-[9px] tabular-nums leading-none text-background shadow-small">
                            {fmtMin(preview.start)}–
                            {addMinutes(fmtMin(preview.start), preview.durationMin)}
                          </span>
                          <span className="h-px flex-1 bg-foreground/60" />
                        </div>
                      )}
                      {dayTasks.map((t) => (
                        <TimedChip
                          key={t.id}
                          task={t}
                          eff={effective(t)}
                          dragging={dragId === t.id}
                          dim={Boolean(focusGoalId) && t.goalId !== focusGoalId}
                          detached={t.kind === "habit" && t.detached}
                          onPointerDownBody={(e) => beginDrag(e, t, "move")}
                          onPointerDownTop={(e) => beginDrag(e, t, "top")}
                          onPointerDownBottom={(e) => beginDrag(e, t, "bottom")}
                          onOpen={() => openTask(t)}
                          menuItems={timedMenuItems(t)}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* empty-week hint */}
              {visibleDays.every((d) => timedTasksForDay(tasks, d.iso).length === 0) && (
                <div className="pointer-events-none absolute inset-x-0 top-1/3 text-center">
                  <p className="text-small text-default-500">
                    Nothing scheduled {mobile ? "this day" : "this week"} — click a slot to add
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Unscheduled rail ─────────────────────────────────────── */}
      <Card shadow="sm" className="mt-5" as="section">
        <button
          type="button"
          onClick={() => setRailOpen((o) => !o)}
          aria-expanded={railOpen}
          aria-controls="unscheduled-rail"
          className="flex w-full items-center gap-2 px-5 py-3.5 text-left"
        >
          <Icon name={railOpen ? "chevD" : "chevR"} size={14} className="text-default-500" />
          <span className="text-small font-medium text-foreground">
            Unscheduled ({backlog.length})
          </span>
        </button>
        {railOpen && (
          <div id="unscheduled-rail" className="border-t border-divider p-4">
            {backlog.length === 0 ? (
              <p className="text-small text-default-500">No unscheduled tasks</p>
            ) : (
              <ul className="space-y-1.5">
                {backlog.map((t) => (
                  <BacklogItem
                    key={t.id}
                    task={t}
                    onOpen={() => openTask(t)}
                    onSchedule={() =>
                      scheduleBacklog(t, (days.find((d) => d.today) ?? days[0]).iso)
                    }
                  />
                ))}
              </ul>
            )}
          </div>
        )}
      </Card>

      <TaskDrawer
        task={selected ? (tasks.find((t) => t.id === selected.id) ?? null) : null}
        onClose={closeEditor}
      />

      {/* Right-click an empty slot → add / paste / schedule */}
      {slotMenu && (
        <FloatingMenu
          pos={{ x: slotMenu.x, y: slotMenu.y }}
          onClose={() => setSlotMenu(null)}
          label="Slot actions"
          items={[
            {
              label: "Add task here",
              icon: "plus",
              onSelect: () => createDraftAt(slotMenu.date, slotMenu.time),
            },
            ...(clipboardTask
              ? [
                  {
                    label: `Paste "${clipboardTask.title}"`,
                    icon: "clipboard",
                    onSelect: () => pasteAt(slotMenu.date, slotMenu.time),
                  } as MenuItem,
                ]
              : []),
            {
              label: "Schedule existing task…",
              icon: "calendar",
              disabled: backlog.length === 0,
              onSelect: () => setScheduleSlot({ date: slotMenu.date, time: slotMenu.time }),
            },
          ]}
        />
      )}

      {/* Schedule-existing-task picker (from the slot menu) */}
      <Modal
        isOpen={!!scheduleSlot}
        onClose={() => setScheduleSlot(null)}
        placement="center"
        scrollBehavior="inside"
        backdrop="blur"
        aria-label="Schedule an existing task"
      >
        <ModalContent>
          <ModalHeader className="flex-col items-start gap-0.5">
            <span className="text-medium font-semibold text-foreground">Schedule a task</span>
            {scheduleSlot && (
              <span className="text-small font-normal text-default-500">
                {fmtShort(scheduleSlot.date)} · {scheduleSlot.time}
              </span>
            )}
          </ModalHeader>
          <ModalBody className="pb-6">
            {backlog.length === 0 ? (
              <p className="text-small text-default-500">No unscheduled tasks.</p>
            ) : (
              <ul className="space-y-1.5">
                {backlog.map((t) => (
                  <li key={t.id}>
                    <ScheduleRow
                      task={t}
                      onPick={() => {
                        if (scheduleSlot) scheduleAt(t, scheduleSlot.date, scheduleSlot.time);
                        setScheduleSlot(null);
                      }}
                    />
                  </li>
                ))}
              </ul>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* "Schedule to time…" — give an all-day chip a time without dragging */}
      <Modal
        isOpen={!!scheduleTask}
        onClose={() => setScheduleTask(null)}
        placement="center"
        scrollBehavior="inside"
        backdrop="blur"
        aria-label="Schedule to a time"
      >
        <ModalContent>
          <ModalHeader className="flex-col items-start gap-0.5">
            <span className="text-medium font-semibold text-foreground">Schedule to a time</span>
            {scheduleTask?.date && (
              <span className="text-small font-normal text-default-500">
                {scheduleTask.title} · {fmtShort(scheduleTask.date)}
              </span>
            )}
          </ModalHeader>
          <ModalBody className="pb-6">
            <p className="text-small text-default-500">
              Pick a start time. It becomes a {DROP_DURATION}-minute block.
            </p>
            <TimePicker
              label="time"
              value={scheduleTask?.time ?? "09:00"}
              clearable={false}
              onChange={(time) => {
                if (scheduleTask && time) scheduleToTime(scheduleTask, time);
                setScheduleTask(null);
              }}
            />
          </ModalBody>
        </ModalContent>
      </Modal>
    </div>
  );
}

function ScheduleRow({ task, onPick }: { task: Task; onPick: () => void }) {
  const accent = useValueColor(task.valueId);
  return (
    <button
      type="button"
      onClick={onPick}
      className="flex w-full items-center gap-2.5 rounded-medium border border-divider bg-content1 px-3 py-2 text-left transition-colors hover:border-primary"
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: accent }}
        aria-hidden="true"
      />
      <span className="truncate text-small text-foreground">{task.title}</span>
    </button>
  );
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function FilterChip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <Chip
      as="button"
      type="button"
      size="sm"
      variant={active ? "solid" : "bordered"}
      color={active ? "primary" : "default"}
      onClick={onClick}
      aria-pressed={active}
      className={cx("cursor-pointer", !active && "text-default-500")}
    >
      {children}
    </Chip>
  );
}

function TimedChip({
  task,
  eff,
  dragging,
  dim,
  detached,
  onPointerDownBody,
  onPointerDownTop,
  onPointerDownBottom,
  onOpen,
  menuItems,
}: {
  task: Task;
  eff: { start: number; durationMin: number };
  dragging: boolean;
  dim: boolean;
  detached: boolean;
  onPointerDownBody: (e: React.PointerEvent) => void;
  onPointerDownTop: (e: React.PointerEvent) => void;
  onPointerDownBottom: (e: React.PointerEvent) => void;
  onOpen: () => void;
  menuItems: MenuItem[];
}) {
  const accent = useValueColor(task.valueId);
  const top = chipTop(eff.start);
  const height = chipHeight(eff.durationMin);
  const resolved = task.status === "done" || task.status === "skip";
  const off = isOffWindow(eff.start);
  const timeLabel = dragging
    ? `${fmtMin(eff.start)}–${addMinutes(fmtMin(eff.start), eff.durationMin)}`
    : task.time;

  return (
    <ContextMenu items={menuItems}>
      <button
        type="button"
        data-block
        onPointerDown={onPointerDownBody}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        aria-label={`${task.title}, ${task.time}–${addMinutes(task.time ?? "00:00", task.durationMin)}${detached ? ", detached" : ""}${resolved ? `, ${task.status}` : ""}`}
        className={cx(
          "group absolute left-0.5 right-0.5 block cursor-grab touch-none select-none overflow-hidden rounded-[2px] border-l-[3px] bg-content1 px-1.5 py-1 text-left shadow-small",
          resolved && "bg-content2",
          dim ? "opacity-30" : "opacity-100",
          dragging
            ? "z-30 cursor-grabbing shadow-medium ring-1 ring-primary"
            : "transition-[top,height] duration-75",
        )}
        style={{
          top,
          height,
          borderColor: accent,
        }}
      >
        {(off || detached) && (
          <span className="absolute right-1 top-1 flex items-center gap-0.5 text-default-400">
            {detached && (
              <span title="Edited away from its habit" aria-hidden="true">
                <Icon name="unlink" size={10} />
              </span>
            )}
            {off && (
              <span title="Outside the visible hours" aria-hidden="true">
                <Icon name="alert" size={10} />
              </span>
            )}
          </span>
        )}
        <span
          onPointerDown={onPointerDownTop}
          className="absolute inset-x-0 top-0 z-10 h-1.5 cursor-ns-resize opacity-0 group-hover:opacity-100"
        />
        <span
          className={cx(
            "block truncate text-[11px] leading-tight text-foreground",
            resolved && "text-default-500 line-through",
          )}
        >
          {task.title}
        </span>
        {height > 34 && (
          <span className="mt-0.5 block text-[9px] tabular-nums text-default-500">{timeLabel}</span>
        )}
        <span
          onPointerDown={onPointerDownBottom}
          className="absolute inset-x-0 bottom-0 z-10 flex h-1.5 cursor-ns-resize items-end justify-center opacity-0 group-hover:opacity-100"
        >
          <span className="mb-px h-0.5 w-5 rounded-full bg-default-300" />
        </span>
      </button>
    </ContextMenu>
  );
}

function AllDayChip({
  task,
  dragging,
  onPointerDownBody,
  onOpen,
  menuItems,
}: {
  task: Task;
  dragging: boolean;
  onPointerDownBody: (e: React.PointerEvent) => void;
  onOpen: () => void;
  menuItems: MenuItem[];
}) {
  const accent = useValueColor(task.valueId);
  const resolved = task.status === "done" || task.status === "skip";
  return (
    <ContextMenu items={menuItems}>
      <button
        type="button"
        data-block
        onPointerDown={onPointerDownBody}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        aria-label={`${task.title}, all day${resolved ? `, ${task.status}` : ""}`}
        className={cx(
          "block w-full cursor-grab touch-none select-none truncate rounded-[2px] border-l-[3px] bg-content1 px-1.5 py-0.5 text-left text-[10px] text-foreground shadow-small",
          dragging && "opacity-40",
        )}
        style={{ borderColor: accent }}
      >
        <span className={cx("truncate", resolved && "text-default-500 line-through")}>
          {task.title}
        </span>
      </button>
    </ContextMenu>
  );
}

function BacklogItem({
  task,
  onOpen,
  onSchedule,
}: {
  task: Task;
  onOpen: () => void;
  onSchedule: () => void;
}) {
  const accent = useValueColor(task.valueId);
  return (
    <li className="flex items-center gap-2">
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${task.title}, unscheduled`}
        className="flex flex-1 items-center gap-2 truncate rounded-medium border border-divider bg-content1 px-2.5 py-1.5 text-left transition-colors hover:border-primary"
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: accent }}
          aria-hidden="true"
        />
        <span className="truncate text-small text-foreground">{task.title}</span>
      </button>
      <Button
        isIconOnly
        size="sm"
        variant="light"
        onPress={onSchedule}
        aria-label={`Schedule ${task.title} for today`}
        title="Schedule for today"
        className="shrink-0 text-default-500"
      >
        <Icon name="calendar" size={14} />
      </Button>
    </li>
  );
}

function NowLine() {
  const now = new Date();
  const cur = now.getHours() * 60 + now.getMinutes();
  if (cur < DAY_START || cur > DAY_END) return null;
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
      style={{ top: chipTop(cur) }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-primary" />
      <span className="h-px flex-1 bg-primary/50" />
    </div>
  );
}
