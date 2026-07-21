import { describe, expect, it } from "vitest";
import { GoogleMock } from "../../../test/google-mock";
import { SyncTokenExpiredError } from "../google-client";

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
