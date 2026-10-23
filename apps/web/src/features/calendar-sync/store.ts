import type { CalendarEvent } from "@vega/shared";
import { getTrpcClient } from "@/core/persistence/trpc-client";
import { saveBulkPut, savePut } from "@/core/store/persist";
import type { Slice } from "@/core/store/slice";
import { saveShowGoogleEvents } from "./config";
import { filterVisibleEvents } from "./display";
import { normalizeEventTiming } from "./event-timing";

const nowISO = () => new Date().toISOString();

/** The server's Google Calendar connection status (mirror of `calendar.status`). */
export interface GcalStatus {
  connected: boolean;
  needsReauth: boolean;
  writeCalendarMissing: boolean;
  writeCalendarId: string | null;
  readCalendarIds: string[];
  calendarPrefs: Record<string, { visible: boolean; summary: string; color: string | null }>;
  lastSyncedAt: string | null;
  backoffUntil: string | null;
  timeZone: string | null;
}

export interface CalendarEventsSlice {
  calendarEvents: CalendarEvent[];
  /** set value/goal/note; propagates to every row sharing the iCalUID (shared invites) */
  tagEvent: (
    id: string,
    patch: { valueId?: string | null; goalId?: string | null; note?: string },
  ) => void;
  /** move/resize a lived event; queues a write-back to Google (vegaEditedAt) */
  editEventTime: (
    id: string,
    at: { date: string | null; endDate: string | null; time: string | null; durationMin: number },
  ) => void;
  /** rename a lived event; queues a write-back */
  renameEvent: (id: string, title: string) => void;
  /** flag a confirmed deletion to be pushed to Google on the next cycle */
  markEventForDelete: (id: string) => void;
  /** deduped, display-ready lived events (per-calendar visibility applied) */
  visibleEvents: () => CalendarEvent[];
  /** server-owned connection status; null when signed out */
  gcalStatus: GcalStatus | null;
  hydrateGcalStatus: (status: GcalStatus | null) => void;
  refreshGcalStatus: () => Promise<void>;
  /** optimistic per-calendar visibility toggle; reconciles on mutation failure */
  setCalendarVisible: (calendarId: string, visible: boolean) => void;
  /** global show/hide of Google events on the calendar (profile-persisted display pref) */
  showGoogleEvents: boolean;
  hydrateShowGoogleEvents: (visible: boolean) => void;
  setShowGoogleEvents: (visible: boolean) => void;
}

export const createCalendarEventsSlice: Slice<CalendarEventsSlice> = (set, get) => ({
  calendarEvents: [],

  tagEvent: (id, patch) => {
    const target = get().calendarEvents.find((e) => e.id === id);
    if (!target) return;
    const touched: CalendarEvent[] = [];
    set((s) => ({
      calendarEvents: s.calendarEvents.map((e) => {
        if (e.iCalUID !== target.iCalUID) return e;
        const next = { ...e, ...patch };
        touched.push(next);
        return next;
      }),
    }));
    if (touched.length) void saveBulkPut("calendarEvents", touched);
  },

  editEventTime: (id, at) => {
    const timing = normalizeEventTiming(at);
    // An undated row has no coherent start/end to patch, so there is nothing to push.
    updateOne(set, id, timing.date == null ? timing : { ...timing, vegaEditedAt: nowISO() });
  },
  renameEvent: (id, title) => updateOne(set, id, { title, vegaEditedAt: nowISO() }),
  markEventForDelete: (id) => updateOne(set, id, { pendingDelete: true }),

  visibleEvents: () =>
    filterVisibleEvents(get().calendarEvents, get().gcalStatus?.calendarPrefs ?? {}),

  gcalStatus: null,
  hydrateGcalStatus: (status) => set({ gcalStatus: status }),
  refreshGcalStatus: async () => {
    if (!get().authUid) {
      set({ gcalStatus: null });
      return;
    }
    try {
      const status = await getTrpcClient().calendar.status.query();
      set({ gcalStatus: status });
    } catch {
      /* offline / server down — keep last-known status */
    }
  },
  setCalendarVisible: (calendarId, visible) => {
    const status = get().gcalStatus;
    if (!status) return;
    const prior = status.calendarPrefs[calendarId];
    set({
      gcalStatus: {
        ...status,
        calendarPrefs: {
          ...status.calendarPrefs,
          [calendarId]: {
            visible,
            summary: prior?.summary ?? calendarId,
            color: prior?.color ?? null,
          },
        },
      },
    });
    void getTrpcClient()
      .calendar.setCalendarVisibility.mutate({ calendarId, visible })
      .catch(() => get().refreshGcalStatus());
  },
  showGoogleEvents: true,
  hydrateShowGoogleEvents: (visible) => set({ showGoogleEvents: visible }),
  setShowGoogleEvents: (visible) => {
    set({ showGoogleEvents: visible });
    saveShowGoogleEvents(get().authUid, visible);
  },
});

function updateOne(
  set: (fn: (s: CalendarEventsSlice) => Partial<CalendarEventsSlice>) => void,
  id: string,
  patch: Partial<CalendarEvent>,
) {
  let next: CalendarEvent | undefined;
  set((s) => ({
    calendarEvents: s.calendarEvents.map((e) => {
      if (e.id !== id) return e;
      next = { ...e, ...patch };
      return next;
    }),
  }));
  if (next) savePut("calendarEvents", next);
}
