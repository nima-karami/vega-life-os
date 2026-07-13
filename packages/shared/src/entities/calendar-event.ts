import { z } from "zod";
import { defineEntity, nullableString } from "./base";

export const calendarEventStatusSchema = z.enum(["confirmed", "cancelled"]);
export const calendarResponseStatusSchema = z.enum([
  "accepted",
  "declined",
  "tentative",
  "needsAction",
]);

const { schema, createSchema } = defineEntity({
  id: z.string(),
  googleId: z.string(),
  iCalUID: z.string(),
  calendarId: z.string(),
  title: z.string(),
  date: nullableString,
  endDate: nullableString,
  time: nullableString,
  durationMin: z.number(),
  allDay: z.boolean(),
  recurringEventId: nullableString,
  googleUpdated: nullableString,
  status: calendarEventStatusSchema,
  responseStatus: calendarResponseStatusSchema.nullable(),
  valueId: nullableString,
  goalId: nullableString,
  note: z.string(),
  vegaEditedAt: nullableString,
  pendingDelete: z.boolean(),
  removedAt: nullableString,
});

export const calendarEventSchema = schema;
export const calendarEventCreateSchema = createSchema;
export type CalendarEvent = z.infer<typeof calendarEventSchema>;
export type CalendarEventCreate = z.infer<typeof calendarEventCreateSchema>;
export type CalendarEventStatus = z.infer<typeof calendarEventStatusSchema>;
export type CalendarResponseStatus = z.infer<typeof calendarResponseStatusSchema>;
