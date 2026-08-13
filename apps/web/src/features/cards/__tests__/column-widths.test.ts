import { afterEach, describe, expect, it, vi } from "vitest";
import {
  buildGridTemplate,
  DEFAULT_COLUMN_WIDTHS,
  MIN_COLUMN_PX,
  RAIL_PX,
  readStoredColumnWidths,
  tableWidth,
  writeStoredColumnWidths,
} from "../manager/column-widths";

function installFakeStorage(overrides?: Partial<Storage>) {
  const store = new Map<string, string>();
  const fake: Storage = {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
    ...overrides,
  };
  vi.stubGlobal("localStorage", fake);
  return store;
}

describe("readStoredColumnWidths", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns the defaults when no value is stored", () => {
    installFakeStorage();
    expect(readStoredColumnWidths()).toEqual(DEFAULT_COLUMN_WIDTHS);
  });

  it("returns the stored widths when the value is fully well-formed", () => {
    const store = installFakeStorage();
    store.set(
      "vega.cardsColumnWidths",
      JSON.stringify({ title: 300, type: 100, category: 140, learning: 160, addedAt: 90 }),
    );
    expect(readStoredColumnWidths()).toEqual({
      title: 300,
      type: 100,
      category: 140,
      learning: 160,
      addedAt: 90,
    });
  });

  it("falls back to each column's default independently when only some columns are stored", () => {
    const store = installFakeStorage();
    store.set("vega.cardsColumnWidths", JSON.stringify({ title: 300 }));
    expect(readStoredColumnWidths()).toEqual({
      ...DEFAULT_COLUMN_WIDTHS,
      title: 300,
    });
  });

  it("falls back to the default for a column whose stored value is a non-numeric string", () => {
    const store = installFakeStorage();
    store.set("vega.cardsColumnWidths", JSON.stringify({ title: "wide" }));
    expect(readStoredColumnWidths()).toEqual(DEFAULT_COLUMN_WIDTHS);
  });

  it("falls back to the default for a negative or zero stored value, without clamping it up", () => {
    const store = installFakeStorage();
    store.set("vega.cardsColumnWidths", JSON.stringify({ title: -10, type: 0 }));
    expect(readStoredColumnWidths()).toEqual({
      ...DEFAULT_COLUMN_WIDTHS,
      title: DEFAULT_COLUMN_WIDTHS.title,
      type: DEFAULT_COLUMN_WIDTHS.type,
    });
  });

  it("clamps a real but too-small stored value up to MIN_COLUMN_PX instead of discarding it", () => {
    const store = installFakeStorage();
    store.set("vega.cardsColumnWidths", JSON.stringify({ title: 50 }));
    expect(readStoredColumnWidths().title).toBe(MIN_COLUMN_PX);
  });

  it("treats malformed JSON as absent and returns full defaults without throwing", () => {
    const store = installFakeStorage();
    store.set("vega.cardsColumnWidths", "{not valid json");
    expect(() => readStoredColumnWidths()).not.toThrow();
    expect(readStoredColumnWidths()).toEqual(DEFAULT_COLUMN_WIDTHS);
  });

  it("ignores unrecognized keys in the stored JSON", () => {
    const store = installFakeStorage();
    store.set(
      "vega.cardsColumnWidths",
      JSON.stringify({ ...DEFAULT_COLUMN_WIDTHS, ghostColumn: 999 }),
    );
    expect(Object.keys(readStoredColumnWidths())).toEqual(Object.keys(DEFAULT_COLUMN_WIDTHS));
  });

  it("returns defaults without throwing when localStorage.getItem throws", () => {
    installFakeStorage({
      getItem: () => {
        throw new Error("private mode");
      },
    });
    expect(() => readStoredColumnWidths()).not.toThrow();
    expect(readStoredColumnWidths()).toEqual(DEFAULT_COLUMN_WIDTHS);
  });

  it("returns defaults without throwing when localStorage itself is undefined", () => {
    vi.stubGlobal("localStorage", undefined);
    expect(() => readStoredColumnWidths()).not.toThrow();
    expect(readStoredColumnWidths()).toEqual(DEFAULT_COLUMN_WIDTHS);
  });
});

describe("writeStoredColumnWidths", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("serializes the full widths object under the vega.cardsColumnWidths key", () => {
    const store = installFakeStorage();
    writeStoredColumnWidths({ title: 300, type: 100, category: 140, learning: 160, addedAt: 90 });
    expect(JSON.parse(store.get("vega.cardsColumnWidths") ?? "")).toEqual({
      title: 300,
      type: 100,
      category: 140,
      learning: 160,
      addedAt: 90,
    });
  });

  it("swallows a write failure instead of throwing", () => {
    installFakeStorage({
      setItem: () => {
        throw new Error("quota exceeded");
      },
    });
    expect(() => writeStoredColumnWidths(DEFAULT_COLUMN_WIDTHS)).not.toThrow();
  });
});

describe("buildGridTemplate", () => {
  it("gives the title column a flexible minmax track and every other column a fixed px track", () => {
    const template = buildGridTemplate(DEFAULT_COLUMN_WIDTHS);
    expect(template).toBe(
      `${RAIL_PX}px minmax(${DEFAULT_COLUMN_WIDTHS.title}px, 1fr) ${DEFAULT_COLUMN_WIDTHS.type}px ${DEFAULT_COLUMN_WIDTHS.category}px ${DEFAULT_COLUMN_WIDTHS.learning}px ${DEFAULT_COLUMN_WIDTHS.addedAt}px ${RAIL_PX}px`,
    );
  });
});

describe("tableWidth", () => {
  it("sums both rails plus every resizable column", () => {
    expect(tableWidth(DEFAULT_COLUMN_WIDTHS)).toBe(
      RAIL_PX * 2 +
        DEFAULT_COLUMN_WIDTHS.title +
        DEFAULT_COLUMN_WIDTHS.type +
        DEFAULT_COLUMN_WIDTHS.category +
        DEFAULT_COLUMN_WIDTHS.learning +
        DEFAULT_COLUMN_WIDTHS.addedAt,
    );
  });
});
