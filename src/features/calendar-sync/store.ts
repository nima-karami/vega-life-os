import { savePut, saveRemove } from "@/core/store/persist";
import type { Slice } from "@/core/store/slice";
import { defaultGcalConfig, type GcalConfig, saveGcalConfig } from "./config";
import type { CalendarEvent } from "./events-model";
import { dedupeForDisplay } from "./reconcile-lived";

const nowISO = () => new Date().toISOString();

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
    at: { date: string | null; time: string | null; durationMin: number },
  ) => void;
  /** rename a lived event; queues a write-back */
  renameEvent: (id: string, title: string) => void;
  /** flag a confirmed deletion to be pushed to Google on the next cycle */
  markEventForDelete: (id: string) => void;
  /** replace one calendar's mirrors with reconcile output (engine pull) */
  applyLivedSync: (calendarId: string, upserts: CalendarEvent[], dropIds: string[]) => void;
  /** deduped, display-ready lived events */
  visibleEvents: () => CalendarEvent[];
  /** user-level connection config (cloud profile when signed in, else device-local) */
  gcal: GcalConfig;
  /** replace the whole config (used on load/sign-in hydration) */
  hydrateGcalConfig: (c: GcalConfig) => void;
  setGcalEnabled: (v: boolean) => void;
  setGcalWriteCalendarId: (id: string | null) => void;
  setGcalReadCalendarIds: (ids: string[]) => void;
  /** show/hide Google events on the calendar */
  setShowGoogleEvents: (v: boolean) => void;
}

export const createCalendarEventsSlice: Slice<CalendarEventsSlice> = (set, get) => {
  // Update one config field in the store, then persist to its home (cloud/local).
  const patchGcal = (patch: Partial<GcalConfig>) => {
    const next = { ...get().gcal, ...patch };
    set({ gcal: next });
    saveGcalConfig(get().authUid, next);
  };
  return {
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
      for (const e of touched) savePut("calendarEvents", e);
    },

    editEventTime: (id, at) => updateOne(set, id, { ...at, vegaEditedAt: nowISO() }),
    renameEvent: (id, title) => updateOne(set, id, { title, vegaEditedAt: nowISO() }),
    markEventForDelete: (id) => updateOne(set, id, { pendingDelete: true }),

    applyLivedSync: (_calendarId, upserts, dropIds) => {
      // Merge by id (incremental pulls carry only changed events) and drop removals;
      // untouched rows — including pending local edits — are preserved.
      const drop = new Set(dropIds);
      const byId = new Map(upserts.map((e) => [e.id, e]));
      set((s) => {
        const next = s.calendarEvents
          .filter((e) => !drop.has(e.id))
          .map((e) => byId.get(e.id) ?? e);
        const existingIds = new Set(s.calendarEvents.map((e) => e.id));
        for (const e of upserts) if (!existingIds.has(e.id)) next.push(e);
        return { calendarEvents: next };
      });
      for (const e of upserts) savePut("calendarEvents", e);
      for (const id of dropIds) saveRemove("calendarEvents", id);
    },

    visibleEvents: () => dedupeForDisplay(get().calendarEvents),

    gcal: defaultGcalConfig(),
    hydrateGcalConfig: (c) => set({ gcal: c }),
    setGcalEnabled: (v) => patchGcal({ enabled: v }),
    setGcalWriteCalendarId: (id) => patchGcal({ writeCalendarId: id }),
    setGcalReadCalendarIds: (ids) => patchGcal({ readCalendarIds: ids }),
    setShowGoogleEvents: (v) => patchGcal({ showGoogleEvents: v }),
  };
};

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
