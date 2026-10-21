import { describe, expect, it } from "vitest";
import { GO_SHORTCUTS } from "../keymap";
import { filterQuietRoutes, listHelpShortcuts } from "../quiet-routes";

describe("filterQuietRoutes", () => {
  const routes = [{ to: "/today" }, { to: "/analytics" }, { to: "/analytics?tab=review" }];

  it("drops Analytics in quiet mode but keeps the weekly review", () => {
    expect(filterQuietRoutes(routes, true).map((r) => r.to)).toEqual([
      "/today",
      "/analytics?tab=review",
    ]);
  });

  it("keeps everything when quiet mode is off", () => {
    expect(filterQuietRoutes(routes, false)).toEqual(routes);
  });

  it("hides the Analytics go-chord from both shortcut lists", () => {
    expect(filterQuietRoutes(GO_SHORTCUTS, true).some((s) => s.key === "a")).toBe(false);
    expect(listHelpShortcuts(true).some((s) => s.keys === "g a")).toBe(false);
    expect(listHelpShortcuts(true).some((s) => s.keys === "⌘K")).toBe(true);
    expect(listHelpShortcuts(false).some((s) => s.keys === "g a")).toBe(true);
  });
});
