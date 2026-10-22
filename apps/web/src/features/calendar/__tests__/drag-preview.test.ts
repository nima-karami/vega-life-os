import { describe, expect, it } from "vitest";
import { getTravelMode, isPastDragThreshold, placeDragAt } from "../drag-preview";
import { DAY_START, DROP_DURATION, GUTTER, HOUR_PX } from "../geometry";
import { buildDrag } from "./drag-fixtures";

const COLUMNS = ["2026-10-19", "2026-10-20", "2026-10-21", "2026-10-22"].map((iso) => ({ iso }));
const COLUMN_PX = 100;
const WIDTH = GUTTER + COLUMNS.length * COLUMN_PX;
const GRID = { left: 0, top: 100, width: WIDTH, bottom: 1000 };
const ALL_DAY_ROW = { left: 0, top: 60, width: WIDTH, bottom: 100 };

const getColumnX = (index: number) => GUTTER + index * COLUMN_PX + COLUMN_PX / 2;
const getGridY = (minute: number) => GRID.top + ((minute - DAY_START) / 60) * HOUR_PX;

const buildPointer = (
  clientX: number,
  clientY: number,
  allDayRect: typeof ALL_DAY_ROW | undefined,
) => ({ clientX, clientY, gridRect: GRID, allDayRect, columns: COLUMNS });

describe("placeDragAt", () => {
  it("moves a timed chip to the column and minute under the pointer", () => {
    const placed = placeDragAt(
      buildDrag({}),
      buildPointer(getColumnX(2), getGridY(720), undefined),
    );
    expect(placed).toEqual({
      zone: "timed",
      preview: { date: "2026-10-21", start: 720, durationMin: 60, isUntimed: false },
    });
  });

  it("keeps an all-day drag untimed above the seam, measured against the row", () => {
    const drag = buildDrag({ mode: "allday", zone: "untimed" });
    const placed = placeDragAt(drag, buildPointer(getColumnX(3), 80, ALL_DAY_ROW));
    expect(placed.zone).toBe("untimed");
    expect(placed.preview).toMatchObject({ date: "2026-10-22", isUntimed: true });
  });

  it("schedules an all-day drag once it crosses into the grid", () => {
    const drag = buildDrag({ mode: "allday", zone: "untimed" });
    const placed = placeDragAt(drag, buildPointer(getColumnX(1), getGridY(600), ALL_DAY_ROW));
    expect(placed).toEqual({
      zone: "timed",
      preview: { date: "2026-10-20", start: 600, durationMin: DROP_DURATION, isUntimed: false },
    });
  });

  it("holds the current zone inside the seam's hysteresis band", () => {
    const drag = buildDrag({ mode: "allday", zone: "timed" });
    const pointer = buildPointer(getColumnX(0), ALL_DAY_ROW.bottom - 2, ALL_DAY_ROW);
    expect(placeDragAt(drag, pointer).zone).toBe("timed");
  });

  it("stays untimed with no all-day row to measure", () => {
    const drag = buildDrag({ mode: "allday", zone: "timed" });
    const placed = placeDragAt(drag, buildPointer(getColumnX(2), getGridY(900), undefined));
    expect(placed.zone).toBe("untimed");
    expect(placed.preview).toMatchObject({ date: "2026-10-21", isUntimed: true });
  });
});

describe("isPastDragThreshold", () => {
  it("ignores sub-threshold jitter until the drag has moved", () => {
    expect(isPastDragThreshold(buildDrag({}), 3, 0)).toBe(false);
    expect(isPastDragThreshold(buildDrag({}), 4, 0)).toBe(true);
    expect(isPastDragThreshold(buildDrag({ moved: true }), 0, 0)).toBe(true);
  });
});

describe("getTravelMode", () => {
  it("reports an all-day drag as a move", () => {
    expect(getTravelMode("allday")).toBe("move");
    expect(getTravelMode("top")).toBe("top");
  });
});
