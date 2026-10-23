import { describe, expect, it } from "vitest";
import { getSealAnim } from "../seal";

describe("getSealAnim", () => {
  it("seals on any open status → done", () => {
    expect(getSealAnim("active", "done")).toBe("seal");
    expect(getSealAnim("backlog", "done")).toBe("seal");
    expect(getSealAnim("paused", "done")).toBe("seal");
    expect(getSealAnim("abandoned", "done")).toBe("seal");
  });

  it("unseals when a done goal moves to any other status", () => {
    expect(getSealAnim("done", "active")).toBe("unseal");
    expect(getSealAnim("done", "abandoned")).toBe("unseal");
  });

  it("plays nothing for a repeat tap or a change that never touches done", () => {
    expect(getSealAnim("done", "done")).toBeNull();
    expect(getSealAnim("backlog", "active")).toBeNull();
    expect(getSealAnim("active", "paused")).toBeNull();
  });
});
