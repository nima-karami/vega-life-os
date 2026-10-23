import { Card, ScrollShadow } from "@heroui/react";
import { addDays, differenceInCalendarDays, format, parseISO } from "date-fns";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRegisterCommands } from "@/app/commands";
import { useZonedTodayISO } from "@/core/lib/clock";
import { dowIndex, formatShortDate, getWeekDaysFor, minutesOf } from "@/core/lib/date";
import { useStore } from "@/core/store";
import {
  cx,
  isTouchPress,
  type MenuItem,
  type PressSource,
  pressSourceOf,
  UndoBar,
  useCompact,
} from "@/core/ui";
import type { CalendarEvent } from "@/features/calendar-sync";
import { filterVisibleEvents } from "@/features/calendar-sync";
import { useDisplayZone } from "@/features/calendar-sync/useDisplayZone";
import { getFocusableGoals } from "@/features/goals";
import type { Task, TaskStatus } from "@/features/tasks";
import { TaskDrawer } from "@/features/tasks";
import { useValueVoteToast } from "@/features/values/useValueVoteToast";
import { BulkActionBar } from "./BulkActionBar";
import type { ChipHandlers } from "./chip-handlers";
import {
  type ChipPressAction,
  classifyAllDayChipPress,
  classifyTimedChipPress,
} from "./chip-press";
import { AllDayChip } from "./components/AllDayChip";
import { CalendarHeader } from "./components/CalendarHeader";
import { type ColumnHandlers, DayColumn } from "./components/DayColumn";
import { DayStrip } from "./components/DayStrip";
import { EmptyScheduleHint } from "./components/EmptyScheduleHint";
import { MarqueeBox } from "./components/MarqueeBox";
import { MoveToDayModal } from "./components/MoveToDayModal";
import { PasteBanner } from "./components/PasteBanner";
import { ScheduleSlotModal } from "./components/ScheduleSlotModal";
import { ScheduleTimeModal } from "./components/ScheduleTimeModal";
import { SlotActionsMenu, type SlotMenuState } from "./components/SlotActionsMenu";
import { UnscheduledRail } from "./components/UnscheduledRail";
import {
  buildTaskDayIndex,
  computeDragPlacements,
  findIndexedTask,
  getDayTasks,
  indexLivedByDay,
  resolveDayColumn,
} from "./day-index";
import { getTravelMode, isPastDragThreshold, placeDragAt } from "./drag-preview";
import { resolveDragRelease } from "./drag-release";
import type { DragPreview, DragState, GroupMember } from "./drag-state";
import { CalendarEventChip, EventEditor, SpanBarChip } from "./EventEditor";
import {
  type Box,
  type ChipBox,
  DAY_START,
  DRAG_THRESHOLD_PX,
  DROP_DURATION,
  type DragMode,
  formatMinutes,
  GUTTER,
  getMarqueeHits,
  getMinuteAtOffset,
  HOUR_PX,
  HOURS,
  isOffWindow,
  shiftSelection,
} from "./geometry";
import {
  getTimedTasksForDay,
  getUnscheduledTasks,
  getUntimedTasksForDay,
  layoutSpanBars,
} from "./grid-data";
import { isTextEntryElement, resolveSelectionKey } from "./selection-keys";
import { formatTaskCount } from "./task-labels";
import { useCalendarAutoRefresh } from "./useCalendarAutoRefresh";
import { type ChipPress, useChipArming } from "./useChipArming";
import { useDragAutoScroll } from "./useDragAutoScroll";
import { WriteCalendarMissingBanner } from "./WriteCalendarMissingBanner";

const NO_EVENTS: CalendarEvent[] = [];

const findById = <T extends { id: string }>(items: T[], id: string | undefined): T | null =>
  id === undefined ? null : (items.find((item) => item.id === id) ?? null);

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
  const announceVote = useValueVoteToast();
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

  const [selected, setSelected] = useState<Task | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  // Right-click menu for an empty slot, and the "schedule existing task" picker.
  const [slotMenu, setSlotMenu] = useState<SlotMenuState | null>(null);
  const [scheduleSlot, setScheduleSlot] = useState<{ date: string; time: string } | null>(null);
  // "Schedule to time…" — the keyboard path that gives an all-day chip a time.
  const [scheduleTask, setScheduleTask] = useState<Task | null>(null);
  // "Move to day…" — the keyboard/touch path that changes an all-day chip's day.
  const [dayMoveTask, setDayMoveTask] = useState<Task | null>(null);
  const [railOpen, setRailOpen] = useState(false);
  const [announce, setAnnounce] = useState("");
  const compact = useCompact();
  const displayZone = useDisplayZone();
  const todayIso = useZonedTodayISO(displayZone);
  // Offsets, not snapshots: for a signed-in user the display zone resolves after the first
  // paint, so a week or day captured at mount would keep describing the browser's — and a
  // week that excludes its own today has no highlight, no now-line and a wrong drop target.
  const [weekOffset, setWeekOffset] = useState(0);
  // Null until the phone user picks a day; only the two doors that mean "today" — the Today
  // button and the `cal-today` command — come back to it.
  const [pickedDay, setPickedDay] = useState<number | null>(null);
  const activeDay = pickedDay ?? dowIndex(todayIso); // 0..6 on a phone

  const gridRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const allDayRowRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);
  const previewRef = useRef<DragPreview | null>(null);
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
  const applyDragAtRef = useRef<(clientX: number, clientY: number) => void>(() => {});
  const autoScroll = useDragAutoScroll({
    scrollerRef,
    onScrolled: (clientX, clientY) => applyDragAtRef.current(clientX, clientY),
  });
  const columnPressSourceRef = useRef<PressSource>("none");
  const chipPressSourceRef = useRef<PressSource>("none");
  const [dragId, setDragId] = useState<string | null>(null);
  const [preview, setPreview] = useState<DragPreview | null>(null);

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

  const days = useMemo(() => getWeekDaysFor(todayIso, weekOffset), [todayIso, weekOffset]);

  // Per-view commands (calendar is reachable via the command bar; these add actions).
  useRegisterCommands([
    {
      id: "cal-today",
      label: "Calendar: Go to today",
      icon: "calendar",
      keywords: "calendar today week",
      run: ({ close }) => {
        if (dragRef.current) cancelDrag();
        setWeekOffset(0);
        setPickedDay(null);
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
    setAnnounce(`Moved ${formatTaskCount(members.length)}`);
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
    const pending = status === "done" ? selectedTasks().filter((t) => t.status !== "done") : [];
    bulkUpdateTasks(ids, { status });
    for (const task of pending) announceVote(task);
    setAnnounce(`Set ${formatTaskCount(ids.length)} to ${status}`);
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
    setAnnounce(`${formatTaskCount(removed.length)} deleted`);
  };
  const bulkDeleteRef = useRef(bulkDelete);
  bulkDeleteRef.current = bulkDelete;

  const undoBulkDelete = () => {
    if (!pendingUndo) return;
    for (const t of pendingUndo) addTask(t);
    setAnnounce(`Restored ${formatTaskCount(pendingUndo.length)}`);
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
      clearSelection();
      setAnnounce(`${t.title} armed. Drag to move, or drag an edge to resize`);
      if (t.time) startTimedDrag(press, t, "move", "arm");
      else startAllDayDrag(press, t, "arm");
      // Either starter can bail; a flag left true freezes chip scrolling until the next disarm.
      isTouchDragLiveRef.current = dragRef.current !== null;
    },
    onDisarm: () => {
      autoScroll.stop();
      isTouchDragLiveRef.current = false;
      if (dragRef.current) cancelDrag();
      suppressNextClick();
    },
  });
  const autoScrollRef = useRef(autoScroll);
  autoScrollRef.current = autoScroll;
  const armingRef = useRef(arming);
  armingRef.current = arming;
  const disarmRef = useRef(arming.disarm);
  disarmRef.current = arming.disarm;

  // An armed chip belongs to one day with nothing over it: navigating away, or opening any
  // modal, picker or drawer, drops the arm (edges 4 and 6).
  const armContext = [
    activeDay,
    weekOffset,
    railOpen,
    selected?.id,
    editingEvent?.id,
    scheduleSlot?.time,
    scheduleTask?.id,
    dayMoveTask?.id,
    slotMenu?.time,
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

  // A keyboard-invoked menu (Menu key / Shift+F10) carries no press, so without this the last
  // touch on the chip keeps the swallow above armed and the menu never opens.
  const clearChipPressSource = () => {
    chipPressSourceRef.current = "none";
  };

  const toChipPress = (e: React.PointerEvent, t: Task): ChipPress => ({
    id: t.id,
    clientX: e.clientX,
    clientY: e.clientY,
    pointerId: e.pointerId,
  });

  // Remembered only so a still release still counts as a tap. Nothing is swallowed here:
  // the press must reach the chip's ContextMenu wrapper, touch's only route to the menu.
  const rememberChipPress = (e: React.PointerEvent, t: Task, shouldArm: boolean) => {
    chipPressRef.current = { id: t.id, x: e.clientX, y: e.clientY };
    if (shouldArm) arming.beginPress(toChipPress(e, t));
  };

  // An armed chip takes the press itself. stopPropagation is load-bearing: without it a
  // handle press bubbles to the body handler and every resize silently becomes a move.
  const beginArmedDrag = (e: React.PointerEvent, startDrag: () => void) => {
    e.preventDefault();
    e.stopPropagation();
    if (dragRef.current) return; // a live drag owns the chip; a second finger cannot steal it
    isTouchDragLiveRef.current = true;
    arming.beginArmedPress(e.pointerId);
    startDrag();
  };

  // Group move when dragging a member of a multi-selection; otherwise a lone
  // chip drag clears any selection first.
  const startTimedSelectionDrag = (press: ChipPress, t: Task, mode: DragMode) => {
    const inSelection = selectedRef.current.has(t.id);
    const group =
      mode === "move" && inSelection && selectedRef.current.size > 1 ? captureGroup() : undefined;
    if (mode === "move" && !inSelection) clearSelection();
    startTimedDrag(press, t, mode, undefined, group);
  };

  // A plain drag swallows only the default; modifier-select also stops propagation.
  const runChipPressAction = (
    action: ChipPressAction,
    e: React.PointerEvent,
    t: Task,
    zone: "timed" | "allday",
    drags: { startArmedDrag: () => void; startDrag: () => void },
  ) => {
    if (action === "ignore") return;
    if (action === "arm" || action === "tap") {
      rememberChipPress(e, t, action === "arm");
      return;
    }
    if (action === "armed-drag") {
      beginArmedDrag(e, drags.startArmedDrag);
      return;
    }
    e.preventDefault();
    if (action === "drag") {
      drags.startDrag();
      return;
    }
    e.stopPropagation();
    if (action === "range-select") rangeSelect(t, zone);
    else toggleSelect(t, zone);
  };

  const beginDrag = (e: React.PointerEvent, t: Task, mode: DragMode) => {
    const source = pressSourceOf(e.pointerType, compact);
    chipPressSourceRef.current = source;
    if (!gridRef.current || !t.time || !t.date) return;
    const action = classifyTimedChipPress(e, {
      mode,
      compact,
      source,
      isArmed: arming.armedChipId === t.id,
      isOffWindow: isOffWindow(minutesOf(t.time)),
    });
    const press = toChipPress(e, t);
    runChipPressAction(action, e, t, "timed", {
      startArmedDrag: () => startTimedDrag(press, t, mode, "armed-press"),
      startDrag: () => {
        e.stopPropagation();
        startTimedSelectionDrag(press, t, mode);
      },
    });
  };

  const startAllDayDrag = (press: ChipPress, t: Task, touchOrigin?: "arm" | "armed-press") => {
    if (!gridRef.current || !t.date) return;
    dragRef.current = {
      id: t.id,
      mode: "allday",
      origDate: t.date,
      origStart: 0,
      origDur: DROP_DURATION,
      grabMin: 0,
      moved: false,
      startX: press.clientX,
      startY: press.clientY,
      zone: "untimed",
      touchOrigin,
      pointerId: press.pointerId,
    };
    const p = { date: t.date, start: DAY_START, durationMin: DROP_DURATION, isUntimed: true };
    previewRef.current = p;
    setPreview(p);
    setDragId(t.id);
  };

  // Begin dragging an all-day chip: sideways keeps it untimed, down onto the grid schedules it.
  const beginAllDayDrag = (e: React.PointerEvent, t: Task) => {
    const source = pressSourceOf(e.pointerType, compact);
    chipPressSourceRef.current = source;
    if (!gridRef.current || !t.date) return;
    const press = toChipPress(e, t);
    const action = classifyAllDayChipPress(e, {
      compact,
      source,
      isArmed: arming.armedChipId === t.id,
    });
    runChipPressAction(action, e, t, "allday", {
      startArmedDrag: () => startAllDayDrag(press, t, "armed-press"),
      startDrag: () => {
        if (!selectedRef.current.has(t.id)) clearSelection();
        startAllDayDrag(press, t);
      },
    });
  };

  // Abandon an in-flight drag with no change (Esc / navigation).
  const cancelDrag = () => {
    autoScroll.stop();
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
      setAnnounce(`${formatTaskCount(lastHits.length)} selected`);
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
  const relinkItemFor = (t: Task, currentHabits: typeof habits): MenuItem | null => {
    if (t.kind !== "habit" || !t.detached) return null;
    const exists = t.habitId != null && currentHabits.some((h) => h.id === t.habitId);
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

  const endDrag = (d: DragState, p: DragPreview) => {
    const task = tasksRef.current.find((x) => x.id === d.id);
    const release = resolveDragRelease(d, p, task);
    switch (release.kind) {
      case "tap":
        handleChipTapRef.current(d.id);
        return;
      case "open":
        if (task) openTask(task);
        return;
      case "commit":
        commitRef.current(d.id, release.patch);
        setAnnounce(release.announcement);
        markJustDragged();
        return;
      case "group-shift": {
        const members = tasksRef.current.filter((t) => d.group?.some((g) => g.id === t.id));
        applyGroupShift(members, release.dayDelta, release.minDelta);
        markJustDragged();
        return;
      }
      case "dropped":
        markJustDragged();
        return;
      default:
        return;
    }
  };
  const endDragRef = useRef(endDrag);
  endDragRef.current = endDrag;

  // columns the move-drag can land on (on a phone, just the active day)
  const visibleDays = useMemo(
    () => (compact ? [days[activeDay]] : days),
    [compact, days, activeDay],
  );
  const dragDaysRef = useRef(visibleDays);
  dragDaysRef.current = visibleDays;

  const applyDragAt = (clientX: number, clientY: number) => {
    const d = dragRef.current;
    const grid = gridRef.current;
    if (!d || !grid || !isPastDragThreshold(d, clientX, clientY)) return;
    const isAllDay = d.mode === "allday";
    const placed = placeDragAt(d, {
      clientX,
      clientY,
      gridRect: grid.getBoundingClientRect(),
      allDayRect: isAllDay ? allDayRowRef.current?.getBoundingClientRect() : undefined,
      columns: dragDaysRef.current,
    });
    d.moved = true;
    d.zone = placed.zone;
    const isTouchDrag = d.touchOrigin != null;
    if (isTouchDrag) armingRef.current.reportTravel(getTravelMode(d.mode));
    previewRef.current = placed.preview;
    setPreview(placed.preview);
    // Gating on touchOrigin is what keeps a desktop drag free of auto-scroll.
    if (isTouchDrag && !isAllDay) autoScroll.track(clientX, clientY);
  };
  applyDragAtRef.current = applyDragAt;

  useEffect(() => {
    if (!dragId) return;
    const onMove = (e: PointerEvent) => {
      if (e.pointerId !== dragRef.current?.pointerId) return;
      applyDragAtRef.current(e.clientX, e.clientY);
    };
    const onUp = (e: PointerEvent) => {
      const d = dragRef.current;
      if (d && e.pointerId !== d.pointerId) return;
      const p = previewRef.current;
      if (d && p) endDragRef.current(d, p);
      autoScrollRef.current.stop();
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
      autoScrollRef.current.stop();
      isTouchDragLiveRef.current = false;
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onCancel);
      window.removeEventListener("keydown", onKey);
    };
  }, [dragId]);

  // Selection keyboard: Ctrl/Cmd+A (grid hovered) select-all, Esc clear, Delete remove.
  useEffect(() => {
    const selectAllVisible = () => {
      const ids = dragDaysRef.current
        .flatMap((d) => [
          ...getTimedTasksForDay(tasksRef.current, d.iso),
          ...getUntimedTasksForDay(tasksRef.current, d.iso),
        ])
        .map((t) => t.id);
      setSelectedIds(new Set(ids));
      anchorRef.current = null;
      setAnnounce(`${formatTaskCount(ids.length)} selected`);
    };
    const onKey = (e: KeyboardEvent) => {
      if (isTextEntryElement(document.activeElement as HTMLElement | null)) return;
      const action = resolveSelectionKey(e, {
        isGridHovered: gridHoverRef.current,
        hasSelection: selectedRef.current.size > 0,
      });
      if (action === "select-all") {
        e.preventDefault();
        selectAllVisible();
      } else if (action === "clear") {
        setSelectedIds(new Set());
        anchorRef.current = null;
      } else if (action === "delete") {
        e.preventDefault();
        bulkDeleteRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const taskIndex = useMemo(() => buildTaskDayIndex(tasks), [tasks]);
  const placements = useMemo(
    () => computeDragPlacements(dragRef.current, dragId, preview),
    [dragId, preview],
  );

  // The chip currently dragged, and whether the drag began on an all-day chip.
  const dragTask = findIndexedTask(taskIndex, dragId);
  const isAllDayDragging = dragTask != null && dragTask.time == null;

  const copyToClipboard = (t: Task) => {
    copyTask(t);
    pasteSuppressUntil.current = Date.now() + 400;
    pushToast("Copied. Click a slot or chip to paste");
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
  const timedMenuItems = (t: Task, currentHabits: typeof habits): MenuItem[] => {
    const relink = relinkItemFor(t, currentHabits);
    const items: MenuItem[] = [
      { label: "Copy", icon: "copy", onSelect: () => copyToClipboard(t) },
      { label: "Unschedule", icon: "calendar-off", onSelect: () => unschedule(t) },
      { label: "Delete", icon: "trash", danger: true, onSelect: () => deleteTask(t) },
      ...(relink ? [relink] : []),
    ];
    return items.map(withDisarm);
  };
  const allDayMenuItems = (t: Task, currentHabits: typeof habits): MenuItem[] => {
    const relink = relinkItemFor(t, currentHabits);
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
      if (activeDay > 0) setPickedDay((d) => (d ?? dowIndex(todayIso)) - 1);
      else {
        setWeekOffset((o) => o - 1);
        setPickedDay(6);
      }
    } else {
      setWeekOffset((o) => o - 1);
    }
  };
  const gotoNext = () => {
    if (dragRef.current) cancelDrag();
    clearSelection();
    if (compact) {
      if (activeDay < 6) setPickedDay((d) => (d ?? dowIndex(todayIso)) + 1);
      else {
        setWeekOffset((o) => o + 1);
        setPickedDay(0);
      }
    } else {
      setWeekOffset((o) => o + 1);
    }
  };
  const gotoToday = () => {
    if (dragRef.current) cancelDrag();
    clearSelection();
    setWeekOffset(0);
    setPickedDay(null);
    setAnnounce("Showing this week");
  };

  const spanBars = useMemo(
    () =>
      layoutSpanBars(
        livedEvents,
        visibleDays.map((d) => d.iso),
      ),
    [livedEvents, visibleDays],
  );
  const backlog = useMemo(() => getUnscheduledTasks(tasks), [tasks]);
  // assign a backlog task to a day (non-drag keyboard/menu pathway)
  const scheduleBacklog = (t: Task, dayIso: string) => {
    updateTask(t.id, { date: dayIso, time: "09:00", status: "todo" });
    pushToast(`Scheduled "${t.title}"`);
    setAnnounce(`Scheduled ${t.title} on ${dayIso}`);
  };

  const livedByDay = useMemo(
    () =>
      indexLivedByDay(
        livedEvents,
        visibleDays.map((d) => d.iso),
      ),
    [livedEvents, visibleDays],
  );
  const isWeekEmpty = useMemo(
    () => visibleDays.every((d) => getTimedTasksForDay(tasks, d.iso).length === 0),
    [tasks, visibleDays],
  );

  const pageHandlers = {
    beginDrag,
    beginAllDayDrag,
    endChipPress,
    cancelChipPress,
    openTask,
    handleChipMenuOpened,
    handleChipContextMenu,
    clearChipPressSource,
    timedMenuItems,
    allDayMenuItems,
    onColumnClick,
    onColumnContextMenu,
    handleColumnPointerDown,
  };
  const pageHandlersRef = useRef(pageHandlers);
  pageHandlersRef.current = pageHandlers;
  // Rebuilt only when the habits change, since that is what the relink menu item reads.
  const chipHandlers = useMemo<ChipHandlers>(
    () => ({
      onTimedPointerDown: (e, task, mode) => pageHandlersRef.current.beginDrag(e, task, mode),
      onAllDayPointerDown: (e, task) => pageHandlersRef.current.beginAllDayDrag(e, task),
      onPointerUp: (e) => pageHandlersRef.current.endChipPress(e),
      onPointerCancel: () => pageHandlersRef.current.cancelChipPress(),
      onOpen: (task) => pageHandlersRef.current.openTask(task),
      onLongPress: () => pageHandlersRef.current.handleChipMenuOpened(),
      onContextMenu: (e, taskId) => pageHandlersRef.current.handleChipContextMenu(e, taskId),
      onKeyDownCapture: () => pageHandlersRef.current.clearChipPressSource(),
      getTimedMenuItems: (task) => pageHandlersRef.current.timedMenuItems(task, habits),
      getAllDayMenuItems: (task) => pageHandlersRef.current.allDayMenuItems(task, habits),
    }),
    [habits],
  );
  const columnHandlers = useMemo<ColumnHandlers>(
    () => ({
      onPointerDown: (e) => pageHandlersRef.current.handleColumnPointerDown(e),
      onKeyDownCapture: () => {
        columnPressSourceRef.current = "none";
      },
      onClick: (e, dayIso) => pageHandlersRef.current.onColumnClick(e, dayIso),
      onContextMenu: (e, dayIso) => pageHandlersRef.current.onColumnContextMenu(e, dayIso),
      onOpenEvent: setEditingEvent,
    }),
    [],
  );

  return (
    <div className="mx-auto max-w-6xl px-4 py-5">
      <span className="sr-only" role="status" aria-live="polite">
        {announce}
      </span>

      {writeCalendarMissing && <WriteCalendarMissingBanner />}

      <CalendarHeader
        compact={compact}
        days={days}
        activeDay={days[activeDay]}
        displayZone={displayZone}
        focusableGoals={focusableGoals}
        onPrev={gotoPrev}
        onToday={gotoToday}
        onNext={gotoNext}
      />

      {compact && <DayStrip days={days} activeDay={activeDay} onPick={setPickedDay} />}

      {clipboardTask && <PasteBanner title={clipboardTask.title} onCancel={clearClipboard} />}

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
                      {livedByDay.get(d.iso)?.allDay.map((ev) => (
                        <CalendarEventChip
                          key={ev.id}
                          event={ev}
                          variant="allday"
                          onOpen={() => setEditingEvent(ev)}
                        />
                      ))}
                      {getDayTasks(taskIndex, d.iso).untimed.map((t) => (
                        <AllDayChip
                          key={t.id}
                          task={t}
                          dragging={dragId === t.id}
                          selected={selectedIds.has(t.id)}
                          isArmed={arming.armedChipId === t.id}
                          isTouchDragLiveRef={isTouchDragLiveRef}
                          handlers={chipHandlers}
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
            <ScrollShadow
              ref={scrollerRef}
              className="relative"
              style={{ maxHeight: "calc(100dvh - 360px)" }}
            >
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

                <MarqueeBox box={marquee} />

                {/* day columns */}
                {visibleDays.map((d) => {
                  const column = resolveDayColumn(taskIndex, d.iso, placements);
                  const isTarget =
                    dragId != null &&
                    preview != null &&
                    !preview.isUntimed &&
                    preview.date === d.iso;
                  return (
                    <DayColumn
                      key={d.iso}
                      day={d}
                      tasks={column.tasks}
                      placements={column.placements}
                      lived={livedByDay.get(d.iso)?.timed ?? NO_EVENTS}
                      targetPreview={isTarget ? preview : null}
                      allDayGhostTitle={
                        isTarget && dragTask && isAllDayDragging ? dragTask.title : null
                      }
                      dragId={dragId}
                      focusGoalId={focusGoalId}
                      selectedIds={selectedIds}
                      provisional={provisional}
                      armedChipId={arming.armedChipId}
                      hasClipboard={clipboardTask != null}
                      displayZone={displayZone}
                      isTouchDragLiveRef={isTouchDragLiveRef}
                      chipHandlers={chipHandlers}
                      columnHandlers={columnHandlers}
                    />
                  );
                })}
              </div>

              {/* empty-week hint */}
              {isWeekEmpty && <EmptyScheduleHint compact={compact} />}
            </ScrollShadow>
          </div>
        </div>
      </Card>

      <UnscheduledRail
        isOpen={railOpen}
        backlog={backlog}
        onToggle={() => setRailOpen((o) => !o)}
        onOpenTask={openTask}
        onScheduleTask={(t) => scheduleBacklog(t, (days.find((d) => d.today) ?? days[0]).iso)}
      />

      <TaskDrawer task={findById(tasks, selected?.id)} onClose={closeEditor} />

      <EventEditor
        event={findById(calendarEvents, editingEvent?.id)}
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
          message={`${formatTaskCount(pendingUndo.length)} deleted`}
          onUndo={undoBulkDelete}
        />
      )}

      {slotMenu && (
        <SlotActionsMenu
          menu={slotMenu}
          clipboardTitle={clipboardTask?.title}
          hasBacklog={backlog.length > 0}
          onAdd={() => createDraftAt(slotMenu.date, slotMenu.time)}
          onPaste={() => pasteAt(slotMenu.date, slotMenu.time)}
          onScheduleExisting={() => setScheduleSlot({ date: slotMenu.date, time: slotMenu.time })}
          onClose={() => setSlotMenu(null)}
        />
      )}

      <ScheduleSlotModal
        slot={scheduleSlot}
        backlog={backlog}
        onPick={(t) => {
          if (scheduleSlot) scheduleAt(t, scheduleSlot.date, scheduleSlot.time);
          setScheduleSlot(null);
        }}
        onClose={() => setScheduleSlot(null)}
      />

      <ScheduleTimeModal
        task={scheduleTask}
        onPick={(time) => {
          if (scheduleTask && time) scheduleToTime(scheduleTask, time);
          setScheduleTask(null);
        }}
        onClose={() => setScheduleTask(null)}
      />

      <MoveToDayModal
        task={dayMoveTask}
        days={days}
        onPick={(dayIso) => {
          if (dayMoveTask) moveToDay(dayMoveTask.id, dayIso);
          setDayMoveTask(null);
        }}
        onClose={() => setDayMoveTask(null)}
      />
    </div>
  );
}
