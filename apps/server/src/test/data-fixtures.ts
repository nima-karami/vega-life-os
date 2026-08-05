/** Minimal valid create-inputs for the two collections that go through the generic `data` router. */

export function mindCard(id: string, body = "seed") {
  return {
    id,
    title: `Card ${id}`,
    body,
    type: "note" as const,
    origin: "manual" as const,
    category: "life",
    source: null,
    addedAt: "2026-08-01T00:00:00.000Z",
    hiddenAt: null,
    likedAt: null,
    flippable: true,
    box: null,
    lastReviewed: null,
    nextDue: null,
  };
}

export const mindCards = (count: number, prefix: string) =>
  Array.from({ length: count }, (_, index) => mindCard(`${prefix}_${index}`));

export function livedEvent(id: string) {
  return {
    id,
    googleId: `g_${id}`,
    iCalUID: `u_${id}`,
    calendarId: "primary",
    title: "Concert",
    date: "2026-07-13",
    endDate: null,
    time: "09:00",
    durationMin: 120,
    allDay: false,
    recurringEventId: null,
    googleUpdated: null,
    status: "confirmed" as const,
    responseStatus: "accepted" as const,
    valueId: null,
    goalId: null,
    note: "",
    vegaEditedAt: null,
    pendingDelete: false,
    removedAt: null,
  };
}
