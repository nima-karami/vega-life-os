import { describe, expect, it } from "vitest";
import {
  describeEmptyDay,
  describeHabitToggle,
  describeTaskToggle,
  findLiveCopy,
} from "../today-logic";

describe("describeTaskToggle", () => {
  it("announces the new done state", () => {
    expect(describeTaskToggle("done")).toBe("Marked done");
    expect(describeTaskToggle("todo")).toBe("Marked not done");
  });
});

describe("describeHabitToggle", () => {
  it("announces the habit by name", () => {
    expect(describeHabitToggle("Stretch", "done")).toBe("Stretch, done");
    expect(describeHabitToggle("Stretch", "todo")).toBe("Stretch, not done");
  });
});

describe("describeEmptyDay", () => {
  it("points today at the agent and other days at the shortcut", () => {
    expect(describeEmptyDay(true)).toBe(
      "Nothing scheduled yet. Add a task above, or press ⌘K to ask VEGA.",
    );
    expect(describeEmptyDay(false)).toBe(
      "Nothing scheduled for this day. Add a task above, or press ⌘K.",
    );
  });
});

describe("findLiveCopy", () => {
  const items = [
    { id: "a", title: "fresh" },
    { id: "b", title: "other" },
  ];

  it("returns the store's current copy", () => {
    expect(findLiveCopy(items, "a")).toBe(items[0]);
  });

  it("is null when nothing is being edited or the item is gone", () => {
    expect(findLiveCopy(items, undefined)).toBeNull();
    expect(findLiveCopy(items, "missing")).toBeNull();
  });
});
