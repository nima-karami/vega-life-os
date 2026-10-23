import { describe, expect, it } from "vitest";
import { isChunkLoadError } from "../chunk-error";

describe("isChunkLoadError", () => {
  it.each([
    "Failed to fetch dynamically imported module: https://vega/assets/CalendarPage-abc.js",
    "Importing a module script failed.",
    "error loading dynamically imported module: https://vega/assets/x.js",
  ])("recognises a browser's module fetch failure: %s", (message) => {
    expect(isChunkLoadError(new TypeError(message))).toBe(true);
  });

  it("recognises Vite's CSS preload failure", () => {
    expect(isChunkLoadError(new Error("Unable to preload CSS for /assets/x.css"))).toBe(true);
  });

  it("ignores other errors, and module wording outside a TypeError", () => {
    expect(isChunkLoadError(new TypeError("x is not a function"))).toBe(false);
    expect(isChunkLoadError(new Error("Failed to fetch dynamically imported module"))).toBe(false);
    expect(isChunkLoadError("Importing a module script failed.")).toBe(false);
    expect(isChunkLoadError(null)).toBe(false);
  });
});
