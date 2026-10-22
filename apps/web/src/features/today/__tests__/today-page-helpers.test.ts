import { describe, expect, it } from "vitest";
import { buildVoteMessage } from "@/features/values/vote-message";
import { describeEmptyDay, describeTaskCompletion, findLiveCopy } from "../today-logic";

describe("describeTaskCompletion", () => {
  const vote = buildVoteMessage({ name: "Health", identity: "You're someone who moves." });

  it("announces the vote on a valued complete", () => {
    expect(describeTaskCompletion("Run", "done", vote)).toBe(
      "Done. A vote for Health. You're someone who moves.",
    );
  });

  it("announces a plain complete", () => {
    expect(describeTaskCompletion("Run", "done", null)).toBe("Done.");
  });

  it("names the task on undo, vote or not", () => {
    expect(describeTaskCompletion("Run", "todo", vote)).toBe("Run, not done");
    expect(describeTaskCompletion("Run", "todo", null)).toBe("Run, not done");
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
