import { Button, Card, Modal, useOverlayState } from "@heroui/react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRegisterCommands } from "@/app/commands";
import { addMinutes, fmtShort, minutesOf, weekDays, weekStartOf } from "@/core/lib/date";
import { useStore } from "@/core/store";
import {
  ContextMenu,
  cx,
  FloatingMenu,
  Icon,
  type MenuItem,
  TimePicker,
  UndoBar,
  useCompactModal,
} from "@/core/ui";
import type { Task, TaskStatus } from "@/features/tasks";
import { TaskDrawer } from "@/features/tasks";
import { useValueColor } from "@/features/values";
import { BulkActionBar } from "./BulkActionBar";
import { CalendarSync } from "./CalendarSync";
import {
  type Box,
  type ChipBox,
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
  marqueeHits,
  minuteAtOffset,
  resolveDrag,
  shiftSelection,
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
  /** when set, the move shifts a whole selection by the anchor's delta. */
  group?: GroupMember[];
}

interface GroupMember {
  id: string;
  date: string;
  start: number;
  durationMin: number;
  allDay: boolean;
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
  const values = useStore((s) => s.values);
  const updateTask = useStore((s) => s.updateTask);
  const relinkTaskToHabit = useStore((s) => s.relinkTaskToHabit);
  const unscheduleTask = useStore((s) => s.unscheduleTask);
  const bulkUpdateTasks = useStore((s) => s.bulkUpdateTasks);
  const bulkRemoveTasks = useStore((s) => s.bulkRemoveTasks);
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

  // ── Multi-select ──────────────────────────────────────────────────────────
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const selectedRef = useRef(selectedIds);
  selectedRef.current = selectedIds;
  // last-clicked chip — the anchor for Shift-range select
  const anchorRef = useRef<{ id: string; zone: "timed" | "allday"; day: string } | null>(null);
  const [marquee, setMarquee] = useState<Box | null>(null);
  const [provisional, setProvisional] = useState<Set<string>>(() => new Set());
  const marqueeRef = useRef<{
    startX: number;
    startY: number;
    add: boolean;
    moved: boolean;
  } | null>(null);
  const [pendingUndo, setPendingUndo] = useState<Task[] | null>(null);
  const gridHoverRef = useRef(false);

  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;

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
    const t = tasksRef.current.find((x) => x.id === id);
    try {
      if (t?.kind === "habit") updateTask(id, { ...patch, detached: true });
      else updateTask(id, patch);
    } catch {
      pushToast("Couldn’t save that change");
      setAnnounce("Couldn’t save that change");
    }
  };

  // ── Selection helpers ───────────────────────────────────────────────────────
  const clearSelection = () => {
    setSelectedIds(new Set());
    anchorRef.current = null;
  };
  // visual order of the chips in a zone+day (timed by start, all-day by row order)
  const orderedIdsFor = (zone: "timed" | "allday", day: string) =>
    zone === "timed"
      ? timedTasksForDay(tasksRef.current, day)
          .slice()
          .sort((a, b) => minutesOf(a.time ?? "00:00") - minutesOf(b.time ?? "00:00"))
          .map((t) => t.id)
      : untimedTasksForDay(tasksRef.current, day).map((t) => t.id);

  const toggleSelect = (t: Task, zone: "timed" | "allday") => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(t.id)) next.delete(t.id);
      else next.add(t.id);
      return next;
    });
    anchorRef.current = { id: t.id, zone, day: t.date ?? "" };
  };

  const rangeSelect = (t: Task, zone: "timed" | "allday") => {
    const a = anchorRef.current;
    if (!a || a.zone !== zone || a.day !== t.date) {
      toggleSelect(t, zone);
      return;
    }
    const order = orderedIdsFor(zone, t.date ?? "");
    const i1 = order.indexOf(a.id);
    const i2 = order.indexOf(t.id);
    if (i1 < 0 || i2 < 0) {
      toggleSelect(t, zone);
      return;
    }
    const [lo, hi] = i1 < i2 ? [i1, i2] : [i2, i1];
    const range = order.slice(lo, hi + 1);
    setSelectedIds((prev) => new Set([...prev, ...range]));
  };

  // ── Group move + bulk actions ───────────────────────────────────────────────
  // Shift a set of tasks by (dayDelta days, minDelta minutes): timed members clamp
  // by their own duration; all-day members move day-only and stay untimed.
  const applyGroupShift = (members: Task[], dayDelta: number, minDelta: number) => {
    const timed = members.filter((m) => m.time != null && m.date != null);
    const shifts = shiftSelection(
      timed.map((m) => ({
        id: m.id,
        date: m.date as string,
        start: minutesOf(m.time as string),
        durationMin: m.durationMin,
      })),
      dayDelta,
      minDelta,
    );
    for (const s of shifts) commit(s.id, { date: s.date, time: fmtMin(s.start) });
    for (const m of members) {
      if (m.time == null && m.date != null) {
        commit(m.id, { date: format(addDays(parseISO(m.date), dayDelta), "yyyy-MM-dd") });
      }
    }
    setAnnounce(`Moved ${members.length} ${members.length === 1 ? "task" : "tasks"}`);
  };

  const selectedTasks = () => tasksRef.current.filter((t) => selectedRef.current.has(t.id));

  // earliest selected member (date, then start) — the reschedule anchor
  const selectionAnchor = (): Task | null => {
    const list = selectedTasks();
    if (list.length === 0) return null;
    return list.slice().sort((a, b) => {
      const da = a.date ?? "";
      const db = b.date ?? "";
      if (da !== db) return da < db ? -1 : 1;
      return minutesOf(a.time ?? fmtMin(DAY_START)) - minutesOf(b.time ?? fmtMin(DAY_START));
    })[0];
  };

  const bulkReschedule = (newDate: string, newTime: string) => {
    const anchor = selectionAnchor();
    if (!anchor) return;
    const anchorStart = anchor.time ? minutesOf(anchor.time) : DAY_START;
    const dayDelta = differenceInCalendarDays(parseISO(newDate), parseISO(anchor.date as string));
    applyGroupShift(selectedTasks(), dayDelta, minutesOf(newTime) - anchorStart);
    clearSelection();
  };

  const bulkSetStatus = (status: TaskStatus) => {
    const ids = [...selectedRef.current];
    bulkUpdateTasks(ids, { status });
    setAnnounce(`Set ${ids.length} ${ids.length === 1 ? "task" : "tasks"} to ${status}`);
    clearSelection();
  };

  const bulkRelineage = (valueId: string | null, goalId: string | null) => {
    bulkUpdateTasks([...selectedRef.current], { valueId, goalId });
    setAnnounce("Updated value or goal");
    clearSelection();
  };

  const bulkDelete = () => {
    const ids = [...selectedRef.current];
    if (ids.length === 0) return;
    const removed = bulkRemoveTasks(ids);
    clearSelection();
    setPendingUndo(removed);
    setAnnounce(`${removed.length} ${removed.length === 1 ? "task" : "tasks"} deleted`);
  };
  const bulkDeleteRef = useRef(bulkDelete);
  bulkDeleteRef.current = bulkDelete;

  const undoBulkDelete = () => {
    if (!pendingUndo) return;
    for (const t of pendingUndo) addTask(t);
    setAnnounce(`Restored ${pendingUndo.length} ${pendingUndo.length === 1 ? "task" : "tasks"}`);
    setPendingUndo(null);
  };

  // Snapshot the current selection's members as group-move origins.
  const captureGroup = (): GroupMember[] =>
    selectedTasks()
      .filter((m) => m.date != null)
      .map((m) => ({
        id: m.id,
        date: m.date as string,
        start: m.time ? minutesOf(m.time) : 0,
        durationMin: m.durationMin,
        allDay: m.time == null,
      }));

  const beginDrag = (e: React.PointerEvent, t: Task, mode: DragMode) => {
    if (e.button !== 0) return;
    if (!gridRef.current || !t.time || !t.date) return;
    // Selection via modifier-click (desktop only; resize edges ignore it).
    if (mode === "move" && !mobile) {
      if (e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        rangeSelect(t, "timed");
        return;
      }
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        toggleSelect(t, "timed");
        return;
      }
    }
    e.preventDefault();
    e.stopPropagation();
    // Group move when dragging a member of a multi-selection; otherwise a lone
    // chip drag clears any selection first.
    const inSelection = selectedRef.current.has(t.id);
    const group =
      mode === "move" && inSelection && selectedRef.current.size > 1 ? captureGroup() : undefined;
    if (mode === "move" && !inSelection) clearSelection();
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
      group,
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
    // Selection via modifier-click (desktop only).
    if (!mobile) {
      if (e.shiftKey) {
        e.preventDefault();
        e.stopPropagation();
        rangeSelect(t, "allday");
        return;
      }
      if (e.metaKey || e.ctrlKey) {
        e.preventDefault();
        e.stopPropagation();
        toggleSelect(t, "allday");
        return;
      }
    }
    e.preventDefault();
    e.stopPropagation();
    if (!selectedRef.current.has(t.id)) clearSelection();
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

  // Rubber-band selection: press-drag on empty timed-grid space (desktop only).
  const beginMarquee = (e: React.PointerEvent) => {
    if (mobile || e.button !== 0) return;
    if ((e.target as HTMLElement).closest("[data-block]")) return;
    const grid = gridRef.current;
    if (!grid) return;
    const add = e.metaKey || e.ctrlKey || e.shiftKey;
    marqueeRef.current = { startX: e.clientX, startY: e.clientY, add, moved: false };
    let lastHits: string[] = [];

    const chipBoxes = (): ChipBox[] => {
      const r = grid.getBoundingClientRect();
      return [...grid.querySelectorAll<HTMLElement>("[data-chip-id]")].map((el) => {
        const b = el.getBoundingClientRect();
        return {
          id: el.dataset.chipId as string,
          left: b.left - r.left,
          top: b.top - r.top,
          right: b.right - r.left,
          bottom: b.bottom - r.top,
        };
      });
    };

    const onMove = (ev: PointerEvent) => {
      const m = marqueeRef.current;
      if (!m) return;
      if (!m.moved && Math.hypot(ev.clientX - m.startX, ev.clientY - m.startY) < 4) return;
      m.moved = true;
      const r = grid.getBoundingClientRect();
      const box: Box = {
        left: Math.min(m.startX, ev.clientX) - r.left,
        top: Math.min(m.startY, ev.clientY) - r.top,
        right: Math.max(m.startX, ev.clientX) - r.left,
        bottom: Math.max(m.startY, ev.clientY) - r.top,
      };
      lastHits = marqueeHits(box, chipBoxes());
      setMarquee(box);
      setProvisional(new Set(lastHits));
    };
    const onUp = () => {
      const m = marqueeRef.current;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      marqueeRef.current = null;
      setMarquee(null);
      setProvisional(new Set());
      if (!m?.moved) return; // a plain click falls through to onColumnClick
      setSelectedIds((prev) => {
        const next = m.add ? new Set(prev) : new Set<string>();
        for (const id of lastHits) next.add(id);
        return next;
      });
      anchorRef.current = null;
      setAnnounce(`${lastHits.length} ${lastHits.length === 1 ? "task" : "tasks"} selected`);
      justDragged.current = true;
      setTimeout(() => {
        justDragged.current = false;
      }, 0);
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
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
    // Group move: shift every selected member by the anchor's delta.
    if (d.group && d.moved) {
      const dayDelta = differenceInCalendarDays(parseISO(p.date), parseISO(d.origDate));
      const minDelta = p.start - d.origStart;
      const members = tasksRef.current.filter((t) => d.group?.some((g) => g.id === t.id));
      applyGroupShift(members, dayDelta, minDelta);
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
    // a tap (no movement): paste-replace if armed, else clear selection + open
    if (d.mode !== "move" || d.moved) return;
    if (clipRef.current) {
      replaceWithRef.current(d.id, clipRef.current);
      return;
    }
    clearSelection();
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

  // Selection keyboard: Ctrl/Cmd+A (grid hovered) select-all, Esc clear, Delete remove.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = document.activeElement as HTMLElement | null;
      if (el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable)) {
        return;
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "a" && gridHoverRef.current) {
        e.preventDefault();
        const ids = dragDaysRef.current
          .flatMap((d) => [
            ...timedTasksForDay(tasksRef.current, d.iso),
            ...untimedTasksForDay(tasksRef.current, d.iso),
          ])
          .map((t) => t.id);
        setSelectedIds(new Set(ids));
        anchorRef.current = null;
        setAnnounce(`${ids.length} ${ids.length === 1 ? "task" : "tasks"} selected`);
        return;
      }
      if (e.key === "Escape" && selectedRef.current.size > 0) {
        setSelectedIds(new Set());
        anchorRef.current = null;
        return;
      }
      if ((e.key === "Delete" || e.key === "Backspace") && selectedRef.current.size > 0) {
        e.preventDefault();
        bulkDeleteRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const effective = (t: Task) => {
    if (dragId === t.id && preview) {
      return { date: preview.date, start: preview.start, durationMin: preview.durationMin };
    }
    // a non-anchor member of a live group drag shifts by the anchor's delta
    const d = dragRef.current;
    const member = d?.group?.find((g) => g.id === t.id && !g.allDay);
    if (d?.group && preview && dragId && member) {
      const dayDelta = differenceInCalendarDays(parseISO(preview.date), parseISO(d.origDate));
      const [shifted] = shiftSelection([member], dayDelta, preview.start - d.origStart);
      return { date: shifted.date, start: shifted.start, durationMin: member.durationMin };
    }
    return { date: t.date ?? "", start: minutesOf(t.time ?? "00:00"), durationMin: t.durationMin };
  };

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
  const unschedule = (t: Task) => {
    unscheduleTask(t.id);
    pushToast("Moved to backlog");
    setAnnounce("Moved to backlog");
  };

  // Shared chip menus. Timed chips: Copy · Delete · (Relink). All-day chips also
  // get Open and "Schedule to time…" (the keyboard path for drag-to-schedule).
  const timedMenuItems = (t: Task): MenuItem[] => {
    const relink = relinkItemFor(t);
    return [
      { label: "Copy", icon: "copy", onSelect: () => copyToClipboard(t) },
      { label: "Unschedule", icon: "calendar-off", onSelect: () => unschedule(t) },
      { label: "Delete", icon: "trash", danger: true, onSelect: () => deleteTask(t) },
      ...(relink ? [relink] : []),
    ];
  };
  const allDayMenuItems = (t: Task): MenuItem[] => {
    const relink = relinkItemFor(t);
    return [
      { label: "Open", icon: "edit", onSelect: () => openTask(t) },
      { label: "Copy", icon: "copy", onSelect: () => copyToClipboard(t) },
      { label: "Schedule to time…", icon: "clock", onSelect: () => setScheduleTask(t) },
      { label: "Unschedule", icon: "calendar-off", onSelect: () => unschedule(t) },
      { label: "Delete", icon: "trash", danger: true, onSelect: () => deleteTask(t) },
      ...(relink ? [relink] : []),
    ];
  };

  const gotoPrev = () => {
    if (dragRef.current) cancelDrag();
    clearSelection();
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
    clearSelection();
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
    clearSelection();
    setWeekRef(new Date());
    setAnnounce("Showing this week");
  };

  const visibleDays = mobile ? [days[activeDay]] : days;
  const backlog = useMemo(() => unscheduledTasks(tasks), [tasks]);
  const modalResponsive = useCompactModal();
  const scheduleSlotState = useOverlayState({
    isOpen: !!scheduleSlot,
    onOpenChange: (next) => {
      if (!next) setScheduleSlot(null);
    },
  });
  const scheduleTaskState = useOverlayState({
    isOpen: !!scheduleTask,
    onOpenChange: (next) => {
      if (!next) setScheduleTask(null);
    },
  });

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
      <Card className="mb-5 rounded-[16px] border border-border bg-surface">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-3 p-5">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {mobile
                ? `${visibleDays[0].dow} · ${fmtShort(visibleDays[0].iso)}`
                : `${fmtShort(days[0].iso)} – ${fmtShort(days[6].iso)}`}
            </h1>
            <p className="mt-1 text-sm text-muted">Habit instances + scheduled tasks</p>
          </div>

          <div className="ml-auto flex items-center gap-1.5">
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label={mobile ? "Previous day" : "Previous week"}
              onPress={gotoPrev}
            >
              <Icon name="chevL" size={16} />
            </Button>
            <Button
              size="sm"
              variant="secondary"
              onPress={gotoToday}
              aria-current={days.some((d) => d.today) ? "date" : undefined}
            >
              Today
            </Button>
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
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
          <span className="text-sm text-muted">Focus</span>
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
                "flex min-w-[44px] flex-col items-center rounded-[12px] border px-2.5 py-1.5 transition-colors",
                i === activeDay
                  ? "border-accent bg-accent text-accent-foreground"
                  : "border-border bg-surface text-foreground",
                d.today && i !== activeDay && "ring-1 ring-accent",
              )}
            >
              <span className="text-xs text-muted">{d.dow}</span>
              <span className="text-sm font-semibold">{String(d.dom).padStart(2, "0")}</span>
            </button>
          ))}
        </div>
      )}

      {/* ── Paste banner ─────────────────────────────────────────── */}
      {clipboardTask && (
        <Card className="mb-4 rounded-[16px] border border-border bg-surface">
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 px-4 py-3">
            <Icon name="clipboard" size={15} className="text-muted" />
            <span className="text-sm text-foreground">Copied “{clipboardTask.title}”</span>
            <span className="text-sm text-muted">
              — click an empty slot to place it, or a chip to replace
            </span>
            <Button
              size="sm"
              variant="ghost"
              onPress={clearClipboard}
              aria-label="Cancel paste"
              className="ml-auto text-muted"
            >
              <Icon name="close" size={12} />
              Cancel · Esc
            </Button>
          </div>
        </Card>
      )}

      {/* ── Week grid ────────────────────────────────────────────── */}
      <Card
        className="overflow-hidden rounded-[16px] border border-border bg-surface"
        onMouseEnter={() => {
          gridHoverRef.current = true;
        }}
        onMouseLeave={() => {
          gridHoverRef.current = false;
        }}
      >
        <div className="overflow-x-auto">
          <div className={mobile ? "min-w-0" : "min-w-[720px]"}>
            {/* day headers */}
            <div
              className="grid border-b border-border"
              style={{ gridTemplateColumns: `${GUTTER}px repeat(${visibleDays.length}, 1fr)` }}
            >
              <div />
              {visibleDays.map((d) => (
                <div
                  key={d.iso}
                  className={cx(
                    "border-l border-border px-2.5 py-2.5",
                    d.today && "bg-surface-secondary",
                  )}
                >
                  <span className="text-xs text-muted">{d.dow}</span>
                  <span
                    className={cx(
                      "ml-1.5 text-lg font-semibold",
                      d.today ? "text-accent" : "text-foreground",
                    )}
                  >
                    {String(d.dom).padStart(2, "0")}
                  </span>
                  {d.today && (
                    <span className="ml-1.5 inline-block h-1.5 w-1.5 rounded-full bg-accent align-middle" />
                  )}
                </div>
              ))}
            </div>

            {/* all-day / untimed row */}
            <div
              className="grid border-b border-border"
              style={{ gridTemplateColumns: `${GUTTER}px repeat(${visibleDays.length}, 1fr)` }}
            >
              <div className="flex items-center justify-end px-1.5 py-1">
                <span className="text-xs text-muted">All day</span>
              </div>
              {visibleDays.map((d) => (
                <div key={d.iso} className="min-h-[28px] space-y-1 border-l border-border p-1">
                  {untimedTasksForDay(tasks, d.iso).map((t) => (
                    <AllDayChip
                      key={t.id}
                      task={t}
                      dragging={dragId === t.id}
                      selected={selectedIds.has(t.id)}
                      onPointerDownBody={(e) => beginScheduleDrag(e, t)}
                      onOpen={() => openTask(t)}
                      menuItems={allDayMenuItems(t)}
                    />
                  ))}
                </div>
              ))}
            </div>

            {/* timed grid body */}
            <div className="relative overflow-y-auto" style={{ maxHeight: "calc(100dvh - 360px)" }}>
              <div
                ref={gridRef}
                className={cx("relative grid", (dragId || marquee) && "select-none")}
                style={{
                  gridTemplateColumns: `${GUTTER}px repeat(${visibleDays.length}, 1fr)`,
                  height: HOURS.length * HOUR_PX,
                }}
              >
                {/* hour gutter */}
                <div className="relative">
                  {HOURS.map((h, i) => (
                    <div key={h} className="absolute right-1.5" style={{ top: i * HOUR_PX - 5 }}>
                      <span className="text-[9px] tabular-nums text-muted">
                        {String(h).padStart(2, "0")}:00
                      </span>
                    </div>
                  ))}
                </div>

                {/* marquee rubber-band */}
                {marquee && (
                  <div
                    className="pointer-events-none absolute z-40 rounded-[2px] border border-accent/40 bg-accent/10"
                    style={{
                      left: marquee.left,
                      top: marquee.top,
                      width: marquee.right - marquee.left,
                      height: marquee.bottom - marquee.top,
                    }}
                  />
                )}

                {/* day columns */}
                {visibleDays.map((d) => {
                  const dayTasks = tasks.filter((t) => t.time && effective(t).date === d.iso);
                  const isTarget = dragId != null && preview?.date === d.iso;
                  return (
                    <div
                      key={d.iso}
                      className={cx(
                        "relative border-l border-border",
                        d.today && "bg-surface-secondary/40",
                        isTarget && "bg-surface-secondary",
                      )}
                    >
                      <button
                        type="button"
                        aria-label={`Add task on ${d.dow}, ${fmtShort(d.iso)}${d.today ? ", today" : ""}`}
                        onPointerDown={beginMarquee}
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
                          className="pointer-events-none absolute left-0 right-0 border-t border-border/60"
                          style={{ top: i * HOUR_PX }}
                        />
                      ))}
                      {d.today && <NowLine />}
                      {isTarget && preview && scheduleDragging && (
                        <div
                          className="pointer-events-none absolute inset-x-0.5 z-30 overflow-hidden rounded-[2px] border-l-[3px] border-accent bg-surface/80 px-1.5 py-1 shadow-md ring-1 ring-accent"
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
                          <span className="-translate-y-1/2 rounded-[12px] bg-foreground px-1.5 py-0.5 text-[9px] tabular-nums leading-none text-background shadow-sm">
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
                          selected={selectedIds.has(t.id)}
                          provisional={provisional.has(t.id)}
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
                  <p className="text-sm text-muted">
                    Nothing scheduled {mobile ? "this day" : "this week"} — click a slot to add
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      </Card>

      {/* ── Unscheduled rail ─────────────────────────────────────── */}
      <Card className="mt-5 rounded-[16px] border border-border bg-surface">
        <button
          type="button"
          onClick={() => setRailOpen((o) => !o)}
          aria-expanded={railOpen}
          aria-controls="unscheduled-rail"
          className="flex w-full items-center gap-2 px-5 py-3.5 text-left"
        >
          <Icon name={railOpen ? "chevD" : "chevR"} size={14} className="text-muted" />
          <span className="text-sm font-medium text-foreground">
            Unscheduled ({backlog.length})
          </span>
        </button>
        {railOpen && (
          <div id="unscheduled-rail" className="border-t border-border p-4">
            {backlog.length === 0 ? (
              <p className="text-sm text-muted">No unscheduled tasks</p>
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

      {selectedIds.size > 0 && (
        <BulkActionBar
          count={selectedIds.size}
          anchor={selectionAnchor()}
          values={values}
          goals={goals}
          onSetStatus={bulkSetStatus}
          onReschedule={bulkReschedule}
          onRelineage={bulkRelineage}
          onDelete={bulkDelete}
          onClear={clearSelection}
        />
      )}

      {pendingUndo && (
        <UndoBar
          message={`${pendingUndo.length} ${pendingUndo.length === 1 ? "task" : "tasks"} deleted`}
          onUndo={undoBulkDelete}
        />
      )}

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
      <Modal state={scheduleSlotState}>
        <Modal.Backdrop variant="blur">
          <Modal.Container {...modalResponsive}>
            <Modal.Dialog aria-label="Schedule an existing task">
              <Modal.Header className="flex-col items-start gap-0.5">
                <Modal.Heading className="text-base font-semibold text-foreground">
                  Schedule a task
                </Modal.Heading>
                {scheduleSlot && (
                  <span className="text-sm font-normal text-muted">
                    {fmtShort(scheduleSlot.date)} · {scheduleSlot.time}
                  </span>
                )}
              </Modal.Header>
              <Modal.Body className="pb-6">
                {backlog.length === 0 ? (
                  <p className="text-sm text-muted">No unscheduled tasks.</p>
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
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      {/* "Schedule to time…" — give an all-day chip a time without dragging */}
      <Modal state={scheduleTaskState}>
        <Modal.Backdrop variant="blur">
          <Modal.Container {...modalResponsive}>
            <Modal.Dialog aria-label="Schedule to a time">
              <Modal.Header className="flex-col items-start gap-0.5">
                <Modal.Heading className="text-base font-semibold text-foreground">
                  Schedule to a time
                </Modal.Heading>
                {scheduleTask?.date && (
                  <span className="text-sm font-normal text-muted">
                    {scheduleTask.title} · {fmtShort(scheduleTask.date)}
                  </span>
                )}
              </Modal.Header>
              <Modal.Body className="pb-6">
                <p className="text-sm text-muted">
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
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
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
      className="flex w-full items-center gap-2.5 rounded-[12px] border border-border bg-surface px-3 py-2 text-left transition-colors hover:border-accent"
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: accent }}
        aria-hidden="true"
      />
      <span className="truncate text-sm text-foreground">{task.title}</span>
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
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cx(
        "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "bg-surface-secondary text-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}

function TimedChip({
  task,
  eff,
  dragging,
  dim,
  detached,
  selected,
  provisional,
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
  selected: boolean;
  provisional: boolean;
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
        data-chip-id={task.id}
        aria-pressed={selected}
        onPointerDown={onPointerDownBody}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        aria-label={`${task.title}, ${task.time}–${addMinutes(task.time ?? "00:00", task.durationMin)}${detached ? ", detached" : ""}${selected ? ", selected" : ""}${resolved ? `, ${task.status}` : ""}`}
        className={cx(
          "group absolute left-0.5 right-0.5 block cursor-grab touch-none select-none overflow-hidden rounded-[2px] border-l-[3px] bg-surface px-1.5 py-1 text-left shadow-sm",
          resolved && "bg-surface-secondary",
          dim ? "opacity-30" : "opacity-100",
          selected && "z-20 ring-2 ring-accent",
          provisional && !selected && "z-20 ring-2 ring-accent/40",
          dragging
            ? "z-30 cursor-grabbing shadow-md ring-1 ring-accent"
            : "transition-[top,height] duration-75",
        )}
        style={{
          top,
          height,
          borderColor: accent,
        }}
      >
        {(off || detached) && (
          <span className="absolute right-1 top-1 flex items-center gap-0.5 text-muted">
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
            resolved && "text-muted line-through",
          )}
        >
          {task.title}
        </span>
        {height > 34 && (
          <span className="mt-0.5 block text-[9px] tabular-nums text-muted">{timeLabel}</span>
        )}
        <span
          onPointerDown={onPointerDownBottom}
          className="absolute inset-x-0 bottom-0 z-10 flex h-1.5 cursor-ns-resize items-end justify-center opacity-0 group-hover:opacity-100"
        >
          <span className="mb-px h-0.5 w-5 rounded-full bg-border" />
        </span>
      </button>
    </ContextMenu>
  );
}

function AllDayChip({
  task,
  dragging,
  selected,
  onPointerDownBody,
  onOpen,
  menuItems,
}: {
  task: Task;
  dragging: boolean;
  selected: boolean;
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
        aria-pressed={selected}
        onPointerDown={onPointerDownBody}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpen();
          }
        }}
        aria-label={`${task.title}, all day${selected ? ", selected" : ""}${resolved ? `, ${task.status}` : ""}`}
        className={cx(
          "block w-full cursor-grab touch-none select-none truncate rounded-[2px] border-l-[3px] bg-surface px-1.5 py-0.5 text-left text-[10px] text-foreground shadow-sm",
          dragging && "opacity-40",
          selected && "ring-2 ring-accent",
        )}
        style={{ borderColor: accent }}
      >
        <span className={cx("truncate", resolved && "text-muted line-through")}>{task.title}</span>
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
        className="flex flex-1 items-center gap-2 truncate rounded-[12px] border border-border bg-surface px-2.5 py-1.5 text-left transition-colors hover:border-accent"
      >
        <span
          className="h-2 w-2 shrink-0 rounded-full"
          style={{ background: accent }}
          aria-hidden="true"
        />
        <span className="truncate text-sm text-foreground">{task.title}</span>
      </button>
      <Button
        isIconOnly
        size="sm"
        variant="ghost"
        onPress={onSchedule}
        aria-label={`Schedule ${task.title} for today`}
        className="shrink-0 text-muted"
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
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      <span className="h-px flex-1 bg-accent/50" />
    </div>
  );
}
