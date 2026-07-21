import { describe, expect, it } from "vitest";
import { storedTask } from "../../../test/calendar-fixtures";
import { fromGEvent, toGEvent } from "../event-map";
import { formatInstantInZone } from "../time-zone";

describe("formatInstantInZone", () => {
  it("renders an instant as wall-clock date/time in the given zone", () => {
    const instant = new Date("2026-07-21T18:00:00.000Z");
    expect(formatInstantInZone(instant, "America/Toronto")).toEqual({
      date: "2026-07-21",
      time: "14:00",
    });
    expect(formatInstantInZone(instant, "Asia/Tokyo")).toEqual({
      date: "2026-07-22",
      time: "03:00",
    });
  });
});

describe("zone-aware event mapping", () => {
  it("pushes naive wall-clock datetimes with an explicit timeZone", () => {
    const task = storedTask({ date: "2026-07-21", time: "14:00", durationMin: 45 });
    const body = toGEvent(task, "America/Toronto");
    expect(body.start).toEqual({ dateTime: "2026-07-21T14:00:00", timeZone: "America/Toronto" });
    expect(body.end).toEqual({ dateTime: "2026-07-21T14:45:00", timeZone: "America/Toronto" });
  });

  it("reads an offset-bearing Google datetime through the user zone", () => {
    const moved = fromGEvent({ start: { dateTime: "2026-07-21T18:00:00Z" } }, "America/Toronto");
    expect(moved).toEqual({ date: "2026-07-21", time: "14:00" });
  });
});
