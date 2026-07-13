import { describe, expect, it } from "vitest";
import { CHROME_ICON_NAMES } from "@/core/lib/icon-names";
import {
  CHROME_ICONS,
  filterCatalog,
  getGroupedCatalog,
  ICON_CATALOG,
  ICON_CATEGORIES,
} from "../icon-catalog";
import { Ic } from "../icons";

describe("icon catalog drift guard", () => {
  it("has at least 150 pickable icons", () => {
    expect(ICON_CATALOG.length).toBeGreaterThanOrEqual(150);
  });

  it("every catalog name resolves to a glyph in Ic", () => {
    for (const { name } of ICON_CATALOG) {
      expect(Ic[name], `no glyph mapped for "${name}"`).toBeDefined();
    }
  });

  it("catalog names are unique", () => {
    const names = ICON_CATALOG.map((e) => e.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it("pickable and chrome names are disjoint", () => {
    for (const { name } of ICON_CATALOG) {
      expect(CHROME_ICONS.has(name), `"${name}" is both chrome and pickable`).toBe(false);
    }
    // and the reverse: no chrome name leaked into the catalog
    const catalogNames = new Set(ICON_CATALOG.map((e) => e.name));
    for (const chrome of CHROME_ICON_NAMES) {
      expect(catalogNames.has(chrome), `chrome "${chrome}" is in the catalog`).toBe(false);
    }
  });

  it("every entry has a known category and non-empty keywords", () => {
    for (const { name, category, keywords } of ICON_CATALOG) {
      expect(ICON_CATEGORIES, `"${name}" has unknown category "${category}"`).toContain(category);
      expect(keywords.trim().length, `"${name}" has empty keywords`).toBeGreaterThan(0);
    }
  });

  it("every declared category has at least one icon", () => {
    for (const category of ICON_CATEGORIES) {
      const count = ICON_CATALOG.filter((e) => e.category === category).length;
      expect(count, `category "${category}" is empty`).toBeGreaterThan(0);
    }
  });

  it("grouping preserves category order and covers the whole catalog", () => {
    const grouped = getGroupedCatalog();
    const order = grouped.map((g) => g.category);
    expect(order).toEqual(ICON_CATEGORIES.filter((c) => order.includes(c)));
    const flatCount = grouped.reduce((n, g) => n + g.entries.length, 0);
    expect(flatCount).toBe(ICON_CATALOG.length);
  });

  it("filterCatalog matches by name and by keyword, and empties on no match", () => {
    expect(filterCatalog("").length).toBe(ICON_CATALOG.length);
    expect(filterCatalog("heart").some((e) => e.name === "heart")).toBe(true);
    // keyword-only hit: "bullseye" is a keyword of target, not a name
    expect(filterCatalog("bullseye").some((e) => e.name === "target")).toBe(true);
    expect(filterCatalog("zzzznope")).toEqual([]);
  });

  it("never surfaces a chrome glyph through search", () => {
    for (const chrome of CHROME_ICON_NAMES) {
      expect(filterCatalog(chrome).some((e) => e.name === chrome)).toBe(false);
    }
  });
});
