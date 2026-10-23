import { describe, expect, it } from "vitest";
import { advanceRouteLayer, type RouteLayer } from "../route-layer";

const AT_HABITS: RouteLayer = { pathname: "/habits", key: 0, carriedPath: null, direction: null };

describe("advanceRouteLayer", () => {
  it("returns the same layer when nothing changed", () => {
    expect(advanceRouteLayer(AT_HABITS, "/habits", null)).toBe(AT_HABITS);
  });

  it("bumps the key on a plain route change so the fade runs", () => {
    expect(advanceRouteLayer(AT_HABITS, "/today", null)).toMatchObject({
      pathname: "/today",
      key: 1,
      direction: null,
    });
  });

  it("opens forward from the list and holds the key across the swap and its end", () => {
    const started = advanceRouteLayer(AT_HABITS, "/habits", "/habits/h1");
    expect(started).toMatchObject({ key: 0, direction: "open" });
    const swapped = advanceRouteLayer(started, "/habits/h1", "/habits/h1");
    expect(swapped).toMatchObject({ pathname: "/habits/h1", key: 0, direction: "open" });
    expect(advanceRouteLayer(swapped, "/habits/h1", null)).toMatchObject({
      key: 0,
      direction: null,
    });
  });

  it("reads Back when the morph starts on the carried page", () => {
    const onPage: RouteLayer = { ...AT_HABITS, pathname: "/habits/h1", key: 3 };
    const started = advanceRouteLayer(onPage, "/habits/h1", "/habits/h1");
    expect(started.direction).toBe("back");
    expect(advanceRouteLayer(started, "/habits", "/habits/h1")).toMatchObject({
      pathname: "/habits",
      key: 3,
      direction: "back",
    });
  });

  it("fades again after a morph", () => {
    const afterMorph: RouteLayer = { ...AT_HABITS, pathname: "/habits/h1", key: 2 };
    expect(advanceRouteLayer(afterMorph, "/values", null).key).toBe(3);
  });
});
