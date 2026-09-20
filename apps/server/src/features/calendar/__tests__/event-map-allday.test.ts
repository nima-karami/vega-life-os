import type { CalendarEvent } from "@vega/shared";
import { describe, expect, it } from "vitest";
import { calendarEventToGPatch } from "../event-map";

type PatchInput = Pick<
  CalendarEvent,
  "title" | "date" | "endDate" | "time" | "durationMin" | "allDay"
>;

const allDay = (over: Partial<PatchInput> = {}): PatchInput => ({
  title: "Offsite",
  date: "2026-09-20",
  endDate: "2026-09-24",
  time: null,
  durationMin: 0,
  allDay: true,
  ...over,
});

const patch = (over: Partial<PatchInput> = {}) =>
  calendarEventToGPatch(allDay(over), "America/Toronto");

describe("calendarEventToGPatch — the all-day wire end", () => {
  it("sends the day after the inclusive last day", () => {
    expect(patch().end?.date).toBe("2026-09-25");
  });

  it("keeps a single day one day wide on the wire", () => {
    expect(patch({ endDate: "2026-09-20" }).end?.date).toBe("2026-09-21");
  });

  it("treats a missing end as a single day", () => {
    expect(patch({ endDate: null }).end?.date).toBe("2026-09-21");
  });

  it("crosses a year boundary", () => {
    expect(patch({ date: "2026-12-30", endDate: "2026-12-31" }).end?.date).toBe("2027-01-01");
  });

  it("starts on the inclusive first day and nulls the opposing dateTime", () => {
    // events.patch merges start/end field-wise, so a stale dateTime survives unless nulled.
    for (const body of [patch(), patch({ endDate: "2026-09-20" }), patch({ endDate: null })]) {
      expect(body.start?.date).toBe("2026-09-20");
      expect(body.start?.dateTime).toBeNull();
      expect(body.end?.dateTime).toBeNull();
    }
  });

  it("omits start and end entirely for an undated row", () => {
    const body = patch({ date: null });
    expect(body.start).toBeUndefined();
    expect(body.end).toBeUndefined();
    expect(body.summary).toBe("Offsite");
  });
});
