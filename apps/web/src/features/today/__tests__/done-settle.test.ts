import { describe, expect, it } from "vitest";
import {
  cancelSettle,
  clearAnim,
  clearArrival,
  dropStaleSettles,
  EMPTY_SETTLE,
  endVoteHold,
  finishLeaving,
  getCardMotion,
  getSettleDelay,
  getSettlingIds,
  planSettle,
  SETTLE_AFTER_PLAIN_MS,
  SETTLE_AFTER_VOTE_MS,
  type SettleState,
  startComplete,
  startLeaving,
  startUndo,
} from "../done-settle";

const allDone = () => true;

function completed(...entries: Array<[string, boolean]>): SettleState {
  return entries.reduce((state, [id, hasVote]) => startComplete(state, id, hasVote), EMPTY_SETTLE);
}

describe("getSettleDelay", () => {
  it("waits longer when a vote is showing", () => {
    expect(getSettleDelay(true)).toBe(SETTLE_AFTER_VOTE_MS);
    expect(getSettleDelay(false)).toBe(SETTLE_AFTER_PLAIN_MS);
    expect(SETTLE_AFTER_VOTE_MS).toBe(2900);
    expect(SETTLE_AFTER_PLAIN_MS).toBe(1200);
  });
});

describe("startComplete", () => {
  it("holds a valued complete in its vote and plays the complete animation", () => {
    const state = completed(["a", true]);
    expect(state.phases.get("a")).toBe("vote");
    expect(getCardMotion(state, "a")).toEqual({ anim: "complete", isVoting: true, travel: null });
  });

  it("holds an unvalued complete straight in post", () => {
    const state = completed(["a", false]);
    expect(state.phases.get("a")).toBe("post");
    expect(getCardMotion(state, "a")?.isVoting).toBe(false);
  });

  it("stops an arriving row's arrival", () => {
    const arriving = startUndo(EMPTY_SETTLE, "a");
    expect(arriving.arriving.has("a")).toBe(true);
    expect(startComplete(arriving, "a", false).arriving.has("a")).toBe(false);
  });

  it("does not mutate the previous state", () => {
    const before = completed(["a", true]);
    startComplete(before, "b", true);
    expect(before.phases.has("b")).toBe(false);
  });
});

describe("endVoteHold", () => {
  it("moves a voting row to post", () => {
    expect(endVoteHold(completed(["a", true]), "a").phases.get("a")).toBe("post");
  });

  it("is a no-op once the row was undone", () => {
    const undone = startUndo(completed(["a", true]), "a");
    expect(endVoteHold(undone, "a")).toBe(undone);
  });

  it("is a no-op for a row already past its vote", () => {
    const plain = completed(["a", false]);
    expect(endVoteHold(plain, "a")).toBe(plain);
  });
});

describe("startUndo", () => {
  it("releases a row undone during its vote, in place", () => {
    const state = startUndo(completed(["a", true]), "a");
    expect(state.phases.has("a")).toBe(false);
    expect(getCardMotion(state, "a")).toEqual({ anim: "undo", isVoting: false, travel: null });
  });

  it("brings a row undone from Done back with the arrive animation", () => {
    const state = startUndo(EMPTY_SETTLE, "a");
    expect(getCardMotion(state, "a")).toEqual({ anim: "undo", isVoting: false, travel: "arrive" });
  });
});

describe("cancelSettle", () => {
  it("drops every trace of the row", () => {
    const state = cancelSettle(startUndo(completed(["a", true]), "a"), "a");
    expect(getCardMotion(state, "a")).toBeUndefined();
    expect(getSettlingIds(state).has("a")).toBe(false);
    expect(cancelSettle(startUndo(EMPTY_SETTLE, "b"), "b").arriving.has("b")).toBe(false);
  });
});

describe("clearAnim", () => {
  it("clears only the animation it was scheduled for", () => {
    const undone = startUndo(EMPTY_SETTLE, "a");
    expect(clearAnim(undone, "a", "undo").anims.has("a")).toBe(false);
    const recompleted = startComplete(undone, "a", false);
    expect(clearAnim(recompleted, "a", "undo")).toBe(recompleted);
  });
});

describe("planSettle", () => {
  it("waits while any row is voting", () => {
    const state = completed(["a", false], ["b", true]);
    expect(planSettle(state, allDone)).toEqual({ retry: true, leavingIds: [], staleIds: [] });
  });

  it("lets a burst leave together once every vote has ended", () => {
    const voted = completed(["a", true], ["b", true]);
    const stillVoting = endVoteHold(voted, "a");
    expect(planSettle(stillVoting, allDone).retry).toBe(true);
    const ended = endVoteHold(stillVoting, "b");
    expect(planSettle(ended, allDone)).toEqual({
      retry: false,
      leavingIds: ["a", "b"],
      staleIds: [],
    });
  });

  it("drops held rows that are no longer done", () => {
    const state = completed(["a", false], ["b", false]);
    expect(planSettle(state, (id) => id === "a")).toEqual({
      retry: false,
      leavingIds: ["a"],
      staleIds: ["b"],
    });
  });

  it("does not leave a row twice", () => {
    const leaving = startLeaving(completed(["a", false]), ["a"]);
    expect(planSettle(leaving, allDone).leavingIds).toEqual([]);
  });
});

describe("dropStaleSettles", () => {
  it("releases a held row whose stored status is no longer done", () => {
    const state = completed(["a", true], ["b", false]);
    const dropped = dropStaleSettles(state, (id) => id === "b");
    expect(getCardMotion(dropped, "a")).toBeUndefined();
    expect([...getSettlingIds(dropped)]).toEqual(["b"]);
  });

  it("returns the same state when every held row is still done", () => {
    const state = completed(["a", true]);
    expect(dropStaleSettles(state, allDone)).toBe(state);
  });
});

describe("leaving and arriving", () => {
  it("collapses, then remounts in Done with no keyframes and an arrival", () => {
    const leaving = startLeaving(completed(["a", false]), ["a"]);
    expect(getCardMotion(leaving, "a")?.travel).toBe("leave");
    expect(getSettlingIds(leaving).has("a")).toBe(true);

    const moved = finishLeaving(leaving, ["a"]);
    expect(getSettlingIds(moved).has("a")).toBe(false);
    expect(getCardMotion(moved, "a")).toEqual({ anim: null, isVoting: false, travel: "arrive" });

    expect(getCardMotion(clearArrival(moved, ["a"]), "a")).toBeUndefined();
  });

  it("skips a row undone between leave and move", () => {
    const leaving = startLeaving(completed(["a", false]), ["a"]);
    const undone = startUndo(leaving, "a");
    const moved = finishLeaving(undone, ["a"]);
    expect(getCardMotion(moved, "a")).toEqual({ anim: "undo", isVoting: false, travel: null });
  });
});

describe("getSettlingIds", () => {
  it("is every row held in Remaining", () => {
    const state = completed(["a", true], ["b", false]);
    expect([...getSettlingIds(state)]).toEqual(["a", "b"]);
    expect(getSettlingIds(EMPTY_SETTLE).size).toBe(0);
  });
});
