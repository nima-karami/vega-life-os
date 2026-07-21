import { describe, expect, it } from "vitest";
import { storedTask } from "../../../test/calendar-fixtures";
import { GoogleMock } from "../../../test/google-mock";
import { toGEvent } from "../event-map";
import { GoogleHttpError, SyncTokenExpiredError } from "../google-client";

const WINDOW = { window: { backDays: 30, fwdDays: 120 } };

describe("GoogleMock sync-token contract", () => {
  it("full list returns a token; the token then yields only later changes", async () => {
    const google = new GoogleMock();
    google.seedEvent("cal-a", { id: "e1", summary: "one" });
    const full = await google.client.listEvents("cal-a", WINDOW);
    expect(full.events).toHaveLength(1);
    expect(full.nextSyncToken).toBeTruthy();

    const idle = await google.client.listEvents("cal-a", {
      syncToken: full.nextSyncToken ?? "",
    });
    expect(idle.events).toHaveLength(0);

    google.seedEvent("cal-a", { id: "e2", summary: "two" });
    const delta = await google.client.listEvents("cal-a", {
      syncToken: idle.nextSyncToken ?? "",
    });
    expect(delta.events.map((event) => event.id)).toEqual(["e2"]);
  });

  it("an expired token throws SyncTokenExpiredError; a full list recovers", async () => {
    const google = new GoogleMock();
    const full = await google.client.listEvents("cal-a", WINDOW);
    google.expireSyncTokens("cal-a");
    await expect(
      google.client.listEvents("cal-a", { syncToken: full.nextSyncToken ?? "" }),
    ).rejects.toBeInstanceOf(SyncTokenExpiredError);
    const recovered = await google.client.listEvents("cal-a", WINDOW);
    expect(recovered.nextSyncToken).toBeTruthy();
  });

  it("echoes a pushed naive datetime wall-clock-preserving with the zone offset, not a UTC instant", async () => {
    const google = new GoogleMock();
    const body = toGEvent(
      storedTask({ id: "t-tz", date: "2026-07-21", time: "14:00" }),
      "America/Toronto",
    );
    const pushedNaive = body.start?.dateTime ?? "";
    await google.client.insertEvent("cal-tz", body);

    const { events } = await google.client.listEvents("cal-tz", WINDOW);
    const stored = events[0]?.start?.dateTime ?? "";
    expect(stored).toBe("2026-07-21T14:00:00-04:00");
    // The signatureOf(...).slice(0, 19) prefixes must agree, or every reconcile re-patches.
    expect(stored.slice(0, 19)).toBe(pushedNaive.slice(0, 19));
  });

  it("409s an insert over an existing id, including a cancelled one", async () => {
    const google = new GoogleMock();
    google.seedEvent("cal-a", { id: "e1", summary: "one" });
    await expect(
      google.client.insertEvent("cal-a", { id: "e1", summary: "dup" }),
    ).rejects.toMatchObject({ status: 409 });

    await google.client.deleteEvent("cal-a", "e1");
    await expect(
      google.client.insertEvent("cal-a", { id: "e1", summary: "revive" }),
    ).rejects.toBeInstanceOf(GoogleHttpError);
  });

  it("lists seeded calendar infos", async () => {
    const google = new GoogleMock();
    google.seedCalendarInfo({
      id: "primary-cal",
      summary: "Personal",
      primary: true,
      backgroundColor: "#7986cb",
    });
    const calendars = await google.client.listCalendars();
    expect(calendars[0]).toMatchObject({ id: "primary-cal", primary: true });
  });
});
