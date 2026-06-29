/**
 * A mirror of one external Google Calendar event plus VEGA's meaning layer.
 * One row per Google event (keyed by googleId); shared invites (same iCalUID on
 * two calendars) are deduped for display and share a value tag. Google owns the
 * synced fields; VEGA owns valueId/goalId/note.
 */
export interface CalendarEvent {
  id: string; // local id, "ce_…"
  googleId: string;
  iCalUID: string;
  calendarId: string;
  title: string;
  date: string | null; // yyyy-MM-dd
  time: string | null; // "HH:mm", null = all-day
  durationMin: number;
  allDay: boolean;
  recurringEventId: string | null;
  googleUpdated: string | null; // RFC3339, conflict arbitration
  status: "confirmed" | "cancelled";
  responseStatus: "accepted" | "declined" | "tentative" | "needsAction" | null;
  // meaning layer (VEGA-owned)
  valueId: string | null;
  goalId: string | null;
  note: string;
  // sync bookkeeping
  vegaEditedAt: string | null; // local edit awaiting push
  pendingDelete: boolean; // confirmed delete awaiting push
  removedAt: string | null; // removed in Google but retained (tagged history)
}
