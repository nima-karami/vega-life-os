import { calendarEventCreateSchema, calendarEventSchema } from "../calendar-event";
import { describeEntityContract } from "./entity-contract";

describeEntityContract("calendar-event", {
  schema: calendarEventSchema,
  createSchema: calendarEventCreateSchema,
  valid: {
    id: "ce_1",
    googleId: "goog_1",
    iCalUID: "ical_1",
    calendarId: "primary",
    title: "Standup",
    date: "2026-07-13",
    endDate: "2026-07-13",
    time: "09:30",
    durationMin: 15,
    allDay: false,
    recurringEventId: null,
    googleUpdated: "2026-07-13T09:00:00.000Z",
    status: "confirmed",
    responseStatus: "accepted",
    valueId: "v_1",
    goalId: null,
    note: "",
    vegaEditedAt: null,
    pendingDelete: false,
    removedAt: null,
    updatedAt: "2026-07-13T10:00:00.000Z",
    fieldUpdatedAt: { title: "2026-07-13T10:00:00.000Z" },
  },
});
