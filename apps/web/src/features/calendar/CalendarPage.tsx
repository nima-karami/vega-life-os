import { Button, ButtonGroup, Card, Modal, ScrollShadow, useOverlayState } from "@heroui/react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRegisterCommands } from "@/app/commands";
import { useTodayISO } from "@/core/lib/clock";
import {
  addMinutes,
  dowIndex,
  formatShortDate,
  getWeekDays,
  minutesOf,
  weekStartOf,
} from "@/core/lib/date";
import { useStore } from "@/core/store";
import {
  cx,
  FloatingMenu,
  Icon,
  isTouchPress,
  type MenuItem,
  type PressSource,
  pressSourceOf,
  TimePicker,
  UndoBar,
  useCompact,
  useCompactModal,
} from "@/core/ui";
import type { CalendarEvent } from "@/features/calendar-sync";
import { filterVisibleEvents } from "@/features/calendar-sync";
import { getFocusableGoals } from "@/features/goals";
import type { Task, TaskStatus } from "@/features/tasks";
import { TaskDrawer } from "@/features/tasks";
import { BulkActionBar } from "./BulkActionBar";
import { CalendarFilterButton } from "./CalendarFilterButton";
import { CalendarSync } from "./CalendarSync";
import { AllDayChip } from "./components/AllDayChip";
import { BacklogItem } from "./components/BacklogItem";
import { NowLine } from "./components/NowLine";
import { ScheduleRow } from "./components/ScheduleRow";
import { TimedChip } from "./components/TimedChip";
import { CalendarEventChip, EventEditor, SpanBarChip } from "./EventEditor";
import {
  type Box,
  type ChipBox,
  DAY_START,
  DRAG_THRESHOLD_PX,
  DROP_DURATION,
  type DragMode,
  type DropZone,
  dropToSchedule,
  formatMinutes,
  GUTTER,
  getChipHeight,
  getChipTop,
  getColumnIndexAt,
  getMarqueeHits,
  getMinuteAtOffset,
  HOUR_PX,
  HOURS,
  isOffWindow,
  layoutColumns,
  resolveDrag,
  resolveDropZone,
  shiftSelection,
} from "./geometry";
import {
  getSingleDayAllDayLived,
  getTimedLivedForDay,
  getTimedTasksForDay,
  getUnscheduledTasks,
  getUntimedTasksForDay,
  layoutSpanBars,
} from "./grid-data";
import { useCalendarAutoRefresh } from "./useCalendarAutoRefresh";
import { type ChipPress, useChipArming } from "./useChipArming";
import { WriteCalendarMissingBanner } from "./WriteCalendarMissingBanner";

interface DragState {
  id: string;
  /** "allday" = a drag that began on an all-day chip; it can stay untimed or take a time. */
  mode: DragMode | "allday";
  origDate: string;
  origStart: number;
  origDur: number;
  grabMin: number;
  moved: boolean;
  /** pointer origin for the all-day drag threshold (allday mode only). */
  startX: number;
  startY: number;
  /** sticky untimed-vs-timed zone, carried across pointermoves (allday mode only). */
  zone: DropZone;
  /** when set, the move shifts a whole selection by the anchor's delta. */
  group?: GroupMember[];
  /** How a touch drag was entered; `undefined` for a mouse or a pen past `sm`. */
  touchOrigin?: "arm" | "armed-press";
  /** The pointer that owns this drag — the window listeners ignore every other one. */
  pointerId: number;
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
  /** the release keeps the task untimed — start/durationMin are then inert */
  isUntimed: boolean;
}

// A border, not a ring: the strip's horizontal overflow clips a ring top and bottom.
function getDayChipTone(isActive: boolean, isToday: boolean): string {
  if (isActive) return "border-accent bg-accent text-accent-foreground";
  if (isToday) return "border-accent bg-surface text-accent";
  return "border-border bg-surface text-foreground";
}

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
  const focusableGoals = useMemo(() => getFocusableGoals(goals), [goals]);

  // Reset to "All" if the focused goal is no longer active (closed, paused, or removed).
  useEffect(() => {
    if (focusGoalId && !focusableGoals.some((g) => g.id === focusGoalId)) setFocusGoal(null);
  }, [focusGoalId, focusableGoals, setFocusGoal]);

  const calendarEvents = useStore((s) => s.calendarEvents);
  const calendarPrefs = useStore((s) => s.gcalStatus?.calendarPrefs);
  const showGoogleEvents = useStore((s) => s.showGoogleEvents);
  const writeCalendarMissing = useStore((s) => Boolean(s.gcalStatus?.writeCalendarMissing));
  useCalendarAutoRefresh();
  const livedEvents = useMemo(
    () => (showGoogleEvents ? filterVisibleEvents(calendarEvents, calendarPrefs ?? {}) : []),
    [calendarEvents, calendarPrefs, showGoogleEvents],
  );

  const [weekRef, setWeekRef] = useState(() => new Date());
  const [selected, setSelected] = useState<Task | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  // Right-click menu for an empty slot, and the "schedule existing task" picker.
  const [slotMenu, setSlotMenu] = useState<{
    x: number;
    y: number;
    date: string;
    time: string;
    scrim: boolean;
  } | null>(null);
  const [scheduleSlot, setScheduleSlot] = useState<{ date: string; time: string } | null>(null);
  // "Schedule to time…" — the keyboard path that gives an all-day chip a time.
  const [scheduleTask, setScheduleTask] = useState<Task | null>(null);
  // "Move to day…" — the keyboard/touch path that changes an all-day chip's day.
  const [dayMoveTask, setDayMoveTask] = useState<Task | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const [announce, setAnnounce] = useState("");
  const compact = useCompact();
  const todayIso = useTodayISO();
  // Seeded from today, or the first paint flashes Monday before the effect below corrects it.
  const [activeDay, setActiveDay] = useState(() => dowIndex(todayIso)); // 0..6 on a phone

  const gridRef = useRef<HTMLDivElement>(null);
  const allDayRowRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const previewRef = useRef<Preview | null>(null);
  // A phone press on a timed chip, which arms no drag — only a still release is a tap.
  const chipPressRef = useRef<{ id: string; x: number; y: number } | null>(null);
  // Id of a task freshly created by clicking an empty slot — discarded on close
  // if it was never named (so an accidental click doesn't litter the calendar).
  const draftIdRef = useRef<string | null>(null);
  const justDragged = useRef(false);
  const pasteSuppressUntil = useRef(0);
  const gestureSuppressUntil = useRef(0);
  // Read by each chip's non-passive touchmove blocker; a leaked true freezes that chip.
  const isTouchDragLiveRef = useRef(false);
  const columnPressSourceRef = useRef<PressSource>("none");
  const chipPressSourceRef = useRef<PressSource>("none");
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

  const days = useMemo(() => getWeekDays(weekRef, todayIso), [weekRef, todayIso]);

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

  // Crossing the breakpoint swaps the column set underneath the pointer, so the cancel has
  // to land before the browser can dispatch another pointer event — layout effect, not effect.
  const wasCompact = useRef(compact);
  useLayoutEffect(() => {
    if (wasCompact.current === compact) return;
    wasCompact.current = compact;
    cancelChipPressRef.current();
    disarmRef.current();
  }, [compact]);

  // Keep the active single day on today when the week contains it.
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
    return getMinuteAtOffset(clientY - rect.top);
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
    if (Date.now() < gestureSuppressUntil.current) return;
    if ((e.target as HTMLElement).closest("[data-block]")) return;
    const time = formatMinutes(minuteAt(e.clientY));
    if (clipRef.current) pasteAt(dayIso, time);
    else createDraftAt(dayIso, time);
  };

  // Right-click an empty slot → menu (add / paste / schedule existing).
  const onColumnContextMenu = (e: React.MouseEvent, dayIso: string) => {
    if ((e.target as HTMLElement).closest("[data-block]")) return;
    e.preventDefault();
    setSlotMenu({
      x: e.clientX,
      y: e.clientY,
      date: dayIso,
      time: formatMinutes(minuteAt(e.clientY)),
      scrim: isTouchPress(columnPressSourceRef.current),
    });
  };

  // commit a schedule change; a bare move/resize keeps a habit instance bound to its slot (no detach) —
  // updateTask locks slotDate, so the origin day never regenerates a phantom.
  const commit = (id: string, patch: Partial<Task>) => {
    try {
      updateTask(id, patch);
    } catch {
      pushToast("Couldn’t save that change");
      setAnnounce("Couldn’t save that change");
    }
  };

  // Swallow the click that follows a real drag — it would otherwise create a draft task.
  const markJustDragged = () => {
    justDragged.current = true;
    setTimeout(() => {
      justDragged.current = false;
    }, 0);
  };

  // markJustDragged's 0ms tick expires before a touch compatibility click lands, so a
  // gesture that ends on empty grid needs a real time window instead.
  const suppressNextClick = () => {
    gestureSuppressUntil.current = Date.now() + 400;
  };

  // ── Selection helpers ───────────────────────────────────────────────────────
  const clearSelection = () => {
    setSelectedIds(new Set());
    anchorRef.current = null;
  };
  // visual order of the chips in a zone+day (timed by start, all-day by row order)
  const orderedIdsFor = (zone: "timed" | "allday", day: string) =>
    zone === "timed"
      ? getTimedTasksForDay(tasksRef.current, day)
          .slice()
          .sort((a, b) => minutesOf(a.time ?? "00:00") - minutesOf(b.time ?? "00:00"))
          .map((t) => t.id)
      : getUntimedTasksForDay(tasksRef.current, day).map((t) => t.id);

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
    for (const s of shifts) commit(s.id, { date: s.date, time: formatMinutes(s.start) });
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
      return (
        minutesOf(a.time ?? formatMinutes(DAY_START)) -
        minutesOf(b.time ?? formatMinutes(DAY_START))
      );
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

  // The arm timer fires 500ms after the synthetic event that carried the coordinates was
  // pooled, so it replays this snapshot rather than reading a stale event.
  const startTimedDrag = (
    press: ChipPress,
    t: Task,
    mode: DragMode,
    touchOrigin?: "arm" | "armed-press",
    group?: GroupMember[],
  ) => {
    const grid = gridRef.current;
    if (!grid || !t.time || !t.date) return;
    const rect = grid.getBoundingClientRect();
    const pointerMin = DAY_START + ((press.clientY - rect.top) / HOUR_PX) * 60;
    const origStart = minutesOf(t.time);
    dragRef.current = {
      id: t.id,
      mode,
      origDate: t.date,
      origStart,
      origDur: t.durationMin,
      grabMin: pointerMin - origStart,
      moved: false,
      startX: press.clientX,
      startY: press.clientY,
      zone: "timed",
      group,
      touchOrigin,
      pointerId: press.pointerId,
    };
    const p = { date: t.date, start: origStart, durationMin: t.durationMin, isUntimed: false };
    previewRef.current = p;
    setPreview(p);
    setDragId(t.id);
  };

  const arming = useChipArming({
    onArm: (press) => {
      const t = tasksRef.current.find((x) => x.id === press.id);
      if (!t) return;
      chipPressRef.current = null;
      isTouchDragLiveRef.current = true;
      clearSelection();
      setAnnounce(`${t.title} armed — drag to move, or drag an edge to resize`);
      startTimedDrag(press, t, "move", "arm");
    },
    onDisarm: () => {
      isTouchDragLiveRef.current = false;
      if (dragRef.current) cancelDrag();
      suppressNextClick();
    },
  });
  const armingRef = useRef(arming);
  armingRef.current = arming;
  const disarmRef = useRef(arming.disarm);
  disarmRef.current = arming.disarm;

  // An armed chip belongs to one day with nothing over it: navigating away, or opening any
  // modal, picker or drawer, drops the arm (edges 4 and 6).
  const armContext = [
    activeDay,
    weekRef.getTime(),
    railOpen,
    selected?.id ?? "",
    editingEvent?.id ?? "",
    scheduleSlot?.time ?? "",
    scheduleTask?.id ?? "",
    dayMoveTask?.id ?? "",
    slotMenu?.time ?? "",
  ].join("|");
  const armContextRef = useRef(armContext);
  useEffect(() => {
    if (armContextRef.current === armContext) return;
    armContextRef.current = armContext;
    disarmRef.current();
  }, [armContext]);

  useEffect(() => {
    const armedId = armingRef.current.armedChipId;
    if (armedId && !tasks.some((t) => t.id === armedId)) disarmRef.current();
  }, [tasks]);

  const handleChipMenuOpened = () => {
    cancelChipPress();
    arming.yieldToMenu();
  };

  // Every menu item disarms: Copy and Relink open nothing and remove nothing, so without
  // this the chip stays lifted with a live clipboard.
  const withDisarm = (item: MenuItem): MenuItem => ({
    ...item,
    onSelect: () => {
      arming.disarm();
      item.onSelect();
    },
  });

  // Chrome/Android synthesizes `contextmenu` on a touch hold, and `ContextMenu`'s own handler
  // is ungated — left alone, the arming hold would arm and pop the menu at once.
  const handleChipContextMenu = (e: React.MouseEvent, taskId: string) => {
    if (!isTouchPress(chipPressSourceRef.current) || arming.armedChipId === taskId) return;
    e.preventDefault();
    e.stopPropagation();
  };

  const beginDrag = (e: React.PointerEvent, t: Task, mode: DragMode) => {
    chipPressSourceRef.current = pressSourceOf(e.pointerType, compact);
    if (e.button !== 0) return;
    if (!gridRef.current || !t.time || !t.date) return;
    // An armed chip takes the press itself. stopPropagation is load-bearing: without it a
    // handle press bubbles to the body handler and every resize silently becomes a move.
    if (arming.armedChipId === t.id && pressSourceOf(e.pointerType, compact) === "touch") {
      e.preventDefault();
      e.stopPropagation();
      if (dragRef.current) return; // a live drag owns the chip; a second finger cannot steal it
      isTouchDragLiveRef.current = true;
      arming.beginArmedPress(e.pointerId);
      startTimedDrag(
        { id: t.id, clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId },
        t,
        mode,
        "armed-press",
      );
      return;
    }
    // The pointer decides, never the width: a touchscreen laptop is past `sm` and still has
    // only fingers, so a width-gated finger armed a real move drag and silently rescheduled.
    const canResize = e.pointerType === "mouse" || (e.pointerType === "pen" && !compact);
    const canMove = e.pointerType === "mouse" || (e.pointerType !== "touch" && !compact);
    if (!(mode === "move" ? canMove : canResize)) {
      // Remembered only so a still release still counts as a tap. Nothing is swallowed here:
      // the press must reach the chip's ContextMenu wrapper, touch's only route to the menu.
      chipPressRef.current = { id: t.id, x: e.clientX, y: e.clientY };
      const isArmable =
        mode === "move" &&
        arming.armedChipId !== t.id &&
        pressSourceOf(e.pointerType, compact) === "touch" &&
        !isOffWindow(minutesOf(t.time));
      if (isArmable) {
        arming.beginPress({
          id: t.id,
          clientX: e.clientX,
          clientY: e.clientY,
          pointerId: e.pointerId,
        });
      }
      return;
    }
    // Selection via modifier-click (desktop only; resize edges ignore it).
    if (mode === "move" && !compact) {
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
    startTimedDrag(
      { id: t.id, clientX: e.clientX, clientY: e.clientY, pointerId: e.pointerId },
      t,
      mode,
      undefined,
      group,
    );
  };

  // Begin dragging an all-day chip: sideways keeps it untimed, down onto the grid schedules it.
  const beginAllDayDrag = (e: React.PointerEvent, t: Task) => {
    chipPressSourceRef.current = pressSourceOf(e.pointerType, compact);
    if (e.button !== 0) return;
    if (!gridRef.current || !t.date) return;
    // Selection via modifier-click (desktop only).
    if (!compact) {
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
    if (!selectedRef.current.has(t.id)) clearSelection();
    dragRef.current = {
      id: t.id,
      mode: "allday",
      origDate: t.date,
      origStart: 0,
      origDur: DROP_DURATION,
      grabMin: 0,
      moved: false,
      startX: e.clientX,
      startY: e.clientY,
      zone: "untimed",
      pointerId: e.pointerId,
    };
    const p = { date: t.date, start: DAY_START, durationMin: DROP_DURATION, isUntimed: true };
    previewRef.current = p;
    setPreview(p);
    setDragId(t.id);
  };

  // Abandon an in-flight drag with no change (Esc / navigation).
  const cancelDrag = () => {
    isTouchDragLiveRef.current = false;
    dragRef.current = null;
    previewRef.current = null;
    setDragId(null);
    setPreview(null);
  };
  const cancelDragRef = useRef(cancelDrag);
  cancelDragRef.current = cancelDrag;

  // Rubber-band selection: press-drag on empty timed-grid space (desktop only).
  const beginMarquee = (e: React.PointerEvent) => {
    if (compact || e.button !== 0) return;
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
      if (!m.moved && Math.hypot(ev.clientX - m.startX, ev.clientY - m.startY) < DRAG_THRESHOLD_PX)
        return;
      m.moved = true;
      const r = grid.getBoundingClientRect();
      const box: Box = {
        left: Math.min(m.startX, ev.clientX) - r.left,
        top: Math.min(m.startY, ev.clientY) - r.top,
        right: Math.max(m.startX, ev.clientX) - r.left,
        bottom: Math.max(m.startY, ev.clientY) - r.top,
      };
      lastHits = getMarqueeHits(box, chipBoxes());
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
      markJustDragged();
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  };

  const handleColumnPointerDown = (e: React.PointerEvent) => {
    columnPressSourceRef.current = pressSourceOf(e.pointerType, compact);
    beginMarquee(e);
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

  // Return focus to the moved chip: it unmounts from the old cell and remounts in the new one.
  const focusChip = (id: string) => {
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>(`[data-chip-id="${id}"]`)?.focus();
    });
  };

  // Move an all-day task to another visible day, day-only (the non-drag pathway).
  const moveToDay = (id: string, dayIso: string) => {
    const t = tasksRef.current.find((x) => x.id === id);
    if (!t || t.date === dayIso) return;
    commit(id, { date: dayIso });
    pushToast(`Moved "${t.title}" to ${formatShortDate(dayIso)}`);
    setAnnounce(`Moved ${t.title} to ${formatShortDate(dayIso)}`);
    focusChip(id);
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

  const handleChipTap = (id: string) => {
    if (clipRef.current) {
      replaceWithRef.current(id, clipRef.current);
      return;
    }
    clearSelection();
    const t = tasksRef.current.find((x) => x.id === id);
    if (t) openTask(t);
  };
  const handleChipTapRef = useRef(handleChipTap);
  handleChipTapRef.current = handleChipTap;

  // The held press won (or the browser took the touch): drop both the pending tap and,
  // at ≥ sm where a touch does arm a drag, the drag itself.
  const cancelChipPress = () => {
    chipPressRef.current = null;
    if (dragRef.current) cancelDrag();
  };
  const cancelChipPressRef = useRef(cancelChipPress);
  cancelChipPressRef.current = cancelChipPress;

  const endChipPress = (e: React.PointerEvent) => {
    const press = chipPressRef.current;
    chipPressRef.current = null;
    if (!press) return;
    if (Math.hypot(e.clientX - press.x, e.clientY - press.y) >= DRAG_THRESHOLD_PX) return;
    handleChipTap(press.id);
  };

  // Resolve a drag release: commit a real change, or treat a no-move as a tap.
  const endDrag = (d: DragState, p: Preview) => {
    if (d.mode === "allday") {
      const t = tasksRef.current.find((x) => x.id === d.id);
      // A still arming release comes to rest armed; a moved one is a real single-gesture drag.
      if (!d.moved && d.touchOrigin === "arm") return;
      if (!d.moved) {
        if (t) openTask(t); // a tap on an all-day chip still opens it
        return;
      }
      markJustDragged();
      if (!t) return; // vanished under a mid-drag refetch
      if (p.isUntimed) {
        if (p.date === d.origDate) return; // released over its own bucket: write nothing
        commitRef.current(d.id, { date: p.date });
        setAnnounce(`Moved ${t.title} to ${formatShortDate(p.date)}`);
        return;
      }
      commitRef.current(d.id, {
        date: p.date,
        time: formatMinutes(p.start),
        durationMin: DROP_DURATION,
        ...(t.status === "open" ? { status: "todo" } : {}),
      });
      setAnnounce(
        `Scheduled ${t.title} on ${p.date}, ${formatMinutes(p.start)}–${addMinutes(formatMinutes(p.start), DROP_DURATION)}`,
      );
      return;
    }
    // Group move: shift every selected member by the anchor's delta.
    if (d.group && d.moved) {
      const dayDelta = differenceInCalendarDays(parseISO(p.date), parseISO(d.origDate));
      const minDelta = p.start - d.origStart;
      const members = tasksRef.current.filter((t) => d.group?.some((g) => g.id === t.id));
      applyGroupShift(members, dayDelta, minDelta);
      markJustDragged();
      return;
    }
    const changed = p.date !== d.origDate || p.start !== d.origStart || p.durationMin !== d.origDur;
    if (changed) {
      commitRef.current(d.id, {
        date: p.date,
        time: formatMinutes(p.start),
        durationMin: p.durationMin,
      });
      setAnnounce(
        `Moved to ${p.date}, ${formatMinutes(p.start)}–${addMinutes(formatMinutes(p.start), p.durationMin)}`,
      );
      markJustDragged();
      return;
    }
    // An arming release must not also count as a tap; every other term reduces to the
    // pre-touch expression when `touchOrigin` is undefined.
    if (d.moved || d.touchOrigin === "arm") return;
    if (d.mode === "move" || d.touchOrigin === "armed-press") handleChipTapRef.current(d.id);
  };
  const endDragRef = useRef(endDrag);
  endDragRef.current = endDrag;

  // columns the move-drag can land on (on a phone, just the active day)
  const dragDays = compact ? [days[activeDay]] : days;
  const dragDaysRef = useRef(dragDays);
  dragDaysRef.current = dragDays;

  useEffect(() => {
    if (!dragId) return;
    const onMove = (e: PointerEvent) => {
      const d = dragRef.current;
      const grid = gridRef.current;
      if (!d || !grid || e.pointerId !== d.pointerId) return;
      const rect = grid.getBoundingClientRect();
      const cols = dragDaysRef.current;

      if (d.mode === "allday") {
        // ignore sub-threshold jitter so a tap still opens the chip
        const travelPx = Math.hypot(e.clientX - d.startX, e.clientY - d.startY);
        if (!d.moved && travelPx < DRAG_THRESHOLD_PX) return;
        d.moved = true;
        if (d.touchOrigin != null) armingRef.current.reportTravel("move");
        // the seam is the all-day row's bottom edge; a grid-relative Y drifts as the grid scrolls
        const allDayRect = allDayRowRef.current?.getBoundingClientRect();
        // no row box = no seam to measure, so stay untimed rather than silently schedule
        d.zone = allDayRect ? resolveDropZone(e.clientY - allDayRect.bottom, d.zone) : "untimed";
        const isUntimedZone = d.zone === "untimed";
        const box = isUntimedZone && allDayRect ? allDayRect : rect;
        const date = cols[getColumnIndexAt(e.clientX, box, cols.length)].iso;
        const next = isUntimedZone
          ? { date, start: DAY_START, durationMin: DROP_DURATION, isUntimed: true }
          : {
              date,
              start: dropToSchedule(e.clientY - rect.top).startMin,
              durationMin: DROP_DURATION,
              isUntimed: false,
            };
        previewRef.current = next;
        setPreview(next);
        return;
      }

      // ignore sub-threshold jitter so a click still opens the chip
      if (!d.moved && Math.hypot(e.clientX - d.startX, e.clientY - d.startY) < DRAG_THRESHOLD_PX)
        return;
      const date = cols[getColumnIndexAt(e.clientX, rect, cols.length)].iso;
      const pointerMin = DAY_START + ((e.clientY - rect.top) / HOUR_PX) * 60;
      const next = {
        ...resolveDrag(
          d.mode,
          { origDate: d.origDate, origStart: d.origStart, origDur: d.origDur },
          { pointerMin, grabMin: d.grabMin, targetDate: date },
        ),
        isUntimed: false,
      };
      d.moved = true;
      if (d.touchOrigin != null) armingRef.current.reportTravel(d.mode);
      previewRef.current = next;
      setPreview(next);
    };
    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (d && e.pointerId !== d.pointerId) return;
      const p = previewRef.current;
      if (d && p) endDragRef.current(d, p);
      isTouchDragLiveRef.current = false;
      dragRef.current = null;
      previewRef.current = null;
      setDragId(null);
      setPreview(null);
    };
    // Esc, or a touch interrupted by a system gesture, abandons the drag with no change.
    const onCancel = (e: PointerEvent) => {
      if (e.pointerId !== dragRef.current?.pointerId) return;
      cancelDragRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") cancelDragRef.current();
    };
    window.addEventListener("pointermove", onMove);
    // Not { once: true }: with pointerId filtering a foreign pointer would consume the once
    // and strand the drag. The cleanup below already removes it.
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onCancel);
    window.addEventListener("keydown", onKey);
    return () => {
      isTouchDragLiveRef.current = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
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
            ...getTimedTasksForDay(tasksRef.current, d.iso),
            ...getUntimedTasksForDay(tasksRef.current, d.iso),
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

  // The chip currently dragged, and whether the drag began on an all-day chip.
  const dragTask = dragId ? tasks.find((t) => t.id === dragId) : null;
  const isAllDayDragging = dragTask != null && dragTask.time == null;

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
    const items: MenuItem[] = [
      { label: "Copy", icon: "copy", onSelect: () => copyToClipboard(t) },
      { label: "Unschedule", icon: "calendar-off", onSelect: () => unschedule(t) },
      { label: "Delete", icon: "trash", danger: true, onSelect: () => deleteTask(t) },
      ...(relink ? [relink] : []),
    ];
    return items.map(withDisarm);
  };
  const allDayMenuItems = (t: Task): MenuItem[] => {
    const relink = relinkItemFor(t);
    const items: MenuItem[] = [
      { label: "Open", icon: "edit", onSelect: () => openTask(t) },
      { label: "Copy", icon: "copy", onSelect: () => copyToClipboard(t) },
      { label: "Move to day…", icon: "calendar", onSelect: () => setDayMoveTask(t) },
      { label: "Schedule to time…", icon: "clock", onSelect: () => setScheduleTask(t) },
      { label: "Unschedule", icon: "calendar-off", onSelect: () => unschedule(t) },
      { label: "Delete", icon: "trash", danger: true, onSelect: () => deleteTask(t) },
      ...(relink ? [relink] : []),
    ];
    return items.map(withDisarm);
  };

  const gotoPrev = () => {
    if (dragRef.current) cancelDrag();
    clearSelection();
    if (compact) {
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
    if (compact) {
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

  const visibleDays = compact ? [days[activeDay]] : days;
  const spanBars = useMemo(
    () =>
      layoutSpanBars(
        livedEvents,
        visibleDays.map((d) => d.iso),
      ),
    [livedEvents, visibleDays],
  );
  const backlog = useMemo(() => getUnscheduledTasks(tasks), [tasks]);
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
  const dayMoveState = useOverlayState({
    isOpen: !!dayMoveTask,
    onOpenChange: (next) => {
      if (!next) setDayMoveTask(null);
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

      {writeCalendarMissing && <WriteCalendarMissingBanner />}

      {/* ── Nav header — quiet, like Today (keeps the grid in view) ── */}
      <header className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-2">
        <h1 className="text-lg font-semibold tracking-tight text-foreground">
          {compact
            ? `${visibleDays[0].dow} · ${formatShortDate(visibleDays[0].iso)}`
            : `${formatShortDate(days[0].iso)} – ${formatShortDate(days[6].iso)}`}
        </h1>

        <div className="ml-auto flex flex-wrap items-center justify-end gap-x-3 gap-y-2">
          <CalendarSync />
          <CalendarFilterButton focusableGoals={focusableGoals} />
          <div className="flex items-center gap-1.5">
            <Button
              isIconOnly
              size="sm"
              variant="ghost"
              aria-label={compact ? "Previous day" : "Previous week"}
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
              aria-label={compact ? "Next day" : "Next week"}
              onPress={gotoNext}
            >
              <Icon name="chevR" size={16} />
            </Button>
          </div>
        </div>
      </header>

      {/* ── Mobile day strip ─────────────────────────────────────── */}
      {compact && (
        <div className="mb-4 flex gap-1.5 overflow-x-auto no-scrollbar">
          {days.map((d, i) => (
            <button
              key={d.iso}
              type="button"
              onClick={() => setActiveDay(i)}
              aria-current={i === activeDay ? "date" : undefined}
              className={cx(
                "flex min-w-[44px] flex-col items-center rounded-[12px] border px-2.5 py-1.5 transition-colors",
                // one arg, not two: `cx` is not tailwind-merge, so a second border-* would also land
                getDayChipTone(i === activeDay, d.today),
              )}
            >
              <span
                className={cx("text-xs", i === activeDay ? "text-accent-foreground" : "text-muted")}
              >
                {d.dow}
              </span>
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
          <div className={compact ? "min-w-0" : "min-w-[720px]"}>
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
            <div ref={allDayRowRef} className="border-b border-border">
              {/* continuous multi-day bars, packed into lanes */}
              {spanBars.lanes > 0 && (
                <div
                  className="grid gap-y-1 pt-1"
                  style={{
                    gridTemplateColumns: `${GUTTER}px repeat(${visibleDays.length}, 1fr)`,
                    gridAutoRows: "20px",
                  }}
                >
                  {spanBars.bars.map((bar) => (
                    <SpanBarChip
                      key={bar.event.id}
                      event={bar.event}
                      continuesLeft={bar.continuesLeft}
                      continuesRight={bar.continuesRight}
                      onOpen={() => setEditingEvent(bar.event)}
                      style={{
                        gridColumnStart: bar.startCol + 2,
                        gridColumnEnd: bar.startCol + bar.span + 2,
                        gridRowStart: bar.lane + 1,
                      }}
                    />
                  ))}
                </div>
              )}
              {/* per-day single-day all-day chips + untimed tasks */}
              <div
                className="grid"
                style={{ gridTemplateColumns: `${GUTTER}px repeat(${visibleDays.length}, 1fr)` }}
              >
                <div className="flex items-center justify-end px-1.5 py-1">
                  <span className="text-xs text-muted">All day</span>
                </div>
                {visibleDays.map((d) => {
                  const isUntimedTarget =
                    dragId != null && preview?.isUntimed === true && preview.date === d.iso;
                  return (
                    <div
                      key={d.iso}
                      className={cx(
                        // gap, not space-y: the `display:contents` menu wrapper carries no margin.
                        "relative flex min-h-[28px] flex-col gap-1 border-l border-border p-1",
                        isUntimedTarget && "bg-surface-secondary ring-1 ring-inset ring-accent",
                      )}
                    >
                      {getSingleDayAllDayLived(livedEvents, d.iso).map((ev) => (
                        <CalendarEventChip
                          key={ev.id}
                          event={ev}
                          variant="allday"
                          onOpen={() => setEditingEvent(ev)}
                        />
                      ))}
                      {getUntimedTasksForDay(tasks, d.iso).map((t) => (
                        <AllDayChip
                          key={t.id}
                          task={t}
                          dragging={dragId === t.id}
                          selected={selectedIds.has(t.id)}
                          isTouchDragLiveRef={isTouchDragLiveRef}
                          onPointerDownBody={(e) => beginAllDayDrag(e, t)}
                          onOpen={() => openTask(t)}
                          onLongPress={cancelDrag}
                          onChipContextMenu={(e) => handleChipContextMenu(e, t.id)}
                          menuItems={allDayMenuItems(t)}
                        />
                      ))}
                      {isUntimedTarget && (
                        <div className="pointer-events-none absolute inset-x-1 top-1 truncate rounded-[2px] border-l-[3px] border-accent bg-surface px-1.5 py-0.5 text-[10px] text-foreground opacity-80 shadow-sm">
                          {dragTask?.title}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* timed grid body */}
            <ScrollShadow className="relative" style={{ maxHeight: "calc(100dvh - 360px)" }}>
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
                  const dayLived = getTimedLivedForDay(livedEvents, d.iso);
                  const layout = layoutColumns([
                    ...dayTasks.map((t) => {
                      const e = effective(t);
                      return { id: t.id, start: e.start, durationMin: e.durationMin };
                    }),
                    ...dayLived.map((ev) => ({
                      id: ev.id,
                      start: minutesOf(ev.time ?? "00:00"),
                      durationMin: ev.durationMin,
                    })),
                  ]);
                  const isTarget =
                    dragId != null &&
                    preview != null &&
                    !preview.isUntimed &&
                    preview.date === d.iso;
                  return (
                    <div
                      key={d.iso}
                      className={cx(
                        "relative border-l border-border",
                        isTarget ? "bg-surface-secondary" : d.today && "bg-surface-secondary/40",
                      )}
                    >
                      <button
                        type="button"
                        aria-label={`Add task on ${d.dow}, ${formatShortDate(d.iso)}${d.today ? ", today" : ""}`}
                        onPointerDown={handleColumnPointerDown}
                        onKeyDownCapture={() => {
                          columnPressSourceRef.current = "none";
                        }}
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
                      {isTarget && preview && isAllDayDragging && (
                        <div
                          className="pointer-events-none absolute inset-x-0.5 z-30 overflow-hidden rounded-[2px] border-l-[3px] border-accent bg-surface/80 px-1.5 py-1 shadow-md ring-1 ring-accent"
                          style={{
                            top: getChipTop(preview.start),
                            height: getChipHeight(preview.durationMin),
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
                          style={{ top: getChipTop(preview.start) }}
                        >
                          <span className="-translate-y-1/2 rounded-[12px] bg-foreground px-1.5 py-0.5 text-[9px] tabular-nums leading-none text-background shadow-sm">
                            {formatMinutes(preview.start)}–
                            {addMinutes(formatMinutes(preview.start), preview.durationMin)}
                          </span>
                          <span className="h-px flex-1 bg-foreground/60" />
                        </div>
                      )}
                      {dayTasks.map((t) => (
                        <TimedChip
                          key={t.id}
                          task={t}
                          eff={effective(t)}
                          slot={layout[t.id] ?? { col: 0, cols: 1 }}
                          dragging={dragId === t.id}
                          dim={Boolean(focusGoalId) && t.goalId !== focusGoalId}
                          detached={t.kind === "habit" && t.detached}
                          selected={selectedIds.has(t.id)}
                          provisional={provisional.has(t.id)}
                          isArmed={arming.armedChipId === t.id}
                          isTouchDragLiveRef={isTouchDragLiveRef}
                          onPointerDownBody={(e) => beginDrag(e, t, "move")}
                          onPointerUpBody={endChipPress}
                          onPointerCancelBody={cancelChipPress}
                          onPointerDownTop={(e) => beginDrag(e, t, "top")}
                          onPointerDownBottom={(e) => beginDrag(e, t, "bottom")}
                          onOpen={() => openTask(t)}
                          onLongPress={handleChipMenuOpened}
                          onChipContextMenu={(e) => handleChipContextMenu(e, t.id)}
                          onPointerDownHandle={(e, mode) => beginDrag(e, t, mode)}
                          menuItems={timedMenuItems(t)}
                        />
                      ))}
                      {dayLived.map((ev) => (
                        <CalendarEventChip
                          key={ev.id}
                          event={ev}
                          variant="timed"
                          slot={layout[ev.id] ?? { col: 0, cols: 1 }}
                          onOpen={() => setEditingEvent(ev)}
                        />
                      ))}
                    </div>
                  );
                })}
              </div>

              {/* empty-week hint */}
              {visibleDays.every((d) => getTimedTasksForDay(tasks, d.iso).length === 0) && (
                <div className="pointer-events-none absolute inset-x-0 top-1/3 text-center">
                  <p className="text-sm text-muted">
                    Nothing scheduled {compact ? "this day" : "this week"} — click a slot to add
                  </p>
                </div>
              )}
            </ScrollShadow>
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

      <EventEditor
        event={editingEvent ? (calendarEvents.find((e) => e.id === editingEvent.id) ?? null) : null}
        onClose={() => setEditingEvent(null)}
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
          dismissScrim={slotMenu.scrim}
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
                    {formatShortDate(scheduleSlot.date)} · {scheduleSlot.time}
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
                    {scheduleTask.title} · {formatShortDate(scheduleTask.date)}
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

      {/* "Move to day…" — change an all-day chip's day without dragging */}
      <Modal state={dayMoveState}>
        <Modal.Backdrop variant="blur">
          <Modal.Container {...modalResponsive}>
            <Modal.Dialog aria-label="Move to a day">
              <Modal.Header className="flex-col items-start gap-0.5">
                <Modal.Heading className="text-base font-semibold text-foreground">
                  Move to a day
                </Modal.Heading>
                {dayMoveTask?.date && (
                  <span className="text-sm font-normal text-muted">
                    {dayMoveTask.title} · {formatShortDate(dayMoveTask.date)}
                  </span>
                )}
              </Modal.Header>
              <Modal.Body className="pb-6">
                <p className="text-sm text-muted">
                  Pick a day this week. It stays an all-day item — no time is assigned.
                </p>
                <ButtonGroup fullWidth>
                  {days.map((d) => (
                    <Button
                      key={d.iso}
                      size="sm"
                      aria-label={`${d.dow}, ${formatShortDate(d.iso)}${d.today ? ", today" : ""}`}
                      aria-pressed={dayMoveTask?.date === d.iso}
                      variant={dayMoveTask?.date === d.iso ? "primary" : "outline"}
                      className={cx("flex-col gap-0 px-1 py-1.5", d.today && "ring-1 ring-accent")}
                      onPress={() => {
                        if (dayMoveTask) moveToDay(dayMoveTask.id, d.iso);
                        setDayMoveTask(null);
                      }}
                    >
                      <span className="text-[10px] leading-none opacity-70">{d.dow}</span>
                      <span className="text-sm font-semibold leading-none tabular-nums">
                        {String(d.dom).padStart(2, "0")}
                      </span>
                    </Button>
                  ))}
                </ButtonGroup>
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </div>
  );
}
