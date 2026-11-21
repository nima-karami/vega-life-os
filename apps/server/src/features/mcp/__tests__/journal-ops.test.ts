import { describe, expect, it } from "vitest";
import { createLoadedCollection, type LoadedDataset } from "../ops/dataset-loader";
import { planCreateJournal, planUpdateJournal, planWriteJournal } from "../ops/journal-ops";
import { computeZonedClock } from "../zoned-clock";

const clock = computeZonedClock("America/Toronto", Date.parse("2026-11-21T03:30:00Z"));

function journalDataset(
  entries: { id: string; date: string; journal: string }[] = [],
): LoadedDataset {
  return {
    journal: createLoadedCollection(
      entries.map((entry) => ({
        row: {
          ...entry,
          gratitude: [],
          mood: null,
          createdAt: "2026-11-01T00:00:00.000Z",
          updatedAt: "2026-11-01T00:00:00.000Z",
          fieldUpdatedAt: {},
        },
        updateTime: `journal:${entry.id}`,
      })),
    ),
  };
}

describe("planWriteJournal", () => {
  it("creates today's entry in the token zone under day_<date>", () => {
    const outcome = planWriteJournal(
      journalDataset(),
      { gratitude: [" sun ", " "], mood: 4 },
      clock,
    );
    expect(outcome.result.record).toMatchObject({
      id: "day_2026-11-20",
      date: "2026-11-20",
      gratitude: [" sun "],
      mood: 4,
      createdAt: clock.nowIso,
    });
    expect(outcome.changeSet.operations[0].expect).toEqual({ absent: true });
  });

  it("appends to the stored text and keeps the entry's id", () => {
    const dataset = journalDataset([{ id: "day_x", date: "2026-11-19", journal: "morning" }]);
    const outcome = planWriteJournal(
      dataset,
      { date: "2026-11-19", appendJournal: "evening" },
      clock,
    );
    expect(outcome.result.record).toMatchObject({ id: "day_x", journal: "morning\nevening" });
    expect(outcome.changeSet.operations[0].expect).toEqual({ updateTime: "journal:day_x" });
  });

  it("removes an entry that the write leaves empty", () => {
    const dataset = journalDataset([{ id: "day_x", date: "2026-11-19", journal: "morning" }]);
    const outcome = planWriteJournal(dataset, { date: "2026-11-19", journal: "" }, clock);
    expect(outcome.changeSet.operations).toEqual([
      {
        kind: "remove",
        collection: "journal",
        id: "day_x",
        expect: { updateTime: "journal:day_x" },
        storedBytes: 0,
      },
    ]);
    expect(outcome.result).toMatchObject({ record: null, removed: { journal: ["day_x"] } });
  });

  it("refuses a malformed date", () => {
    expect(() =>
      planWriteJournal(journalDataset(), { date: "Nov 19", journal: "x" }, clock),
    ).toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
  });
});

describe("journal create and update", () => {
  const held = journalDataset([{ id: "day_held", date: "2026-11-18", journal: "kept" }]);

  it("merges a create for a held date into that entry", () => {
    const outcome = planCreateJournal(
      held,
      { fields: { date: "2026-11-18", mood: 2 }, ignoredKeys: [] },
      undefined,
      clock,
    );
    expect(outcome.result.record).toMatchObject({ id: "day_held", journal: "kept", mood: 2 });
  });

  it("refuses an explicit id that disagrees with the date's holder", () => {
    expect(() =>
      planCreateJournal(
        held,
        { fields: { date: "2026-11-18", journal: "x" }, ignoredKeys: [] },
        "day_mine",
        clock,
      ),
    ).toThrow(expect.objectContaining({ code: "CONFLICT" }));
  });

  it("refuses moving an entry onto a held date", () => {
    const dataset = journalDataset([
      { id: "day_a", date: "2026-11-18", journal: "a" },
      { id: "day_b", date: "2026-11-19", journal: "b" },
    ]);
    expect(() =>
      planUpdateJournal(
        dataset,
        "day_b",
        { fields: { date: "2026-11-18" }, ignoredKeys: [] },
        clock,
      ),
    ).toThrow(expect.objectContaining({ code: "CONFLICT" }));
  });
});
