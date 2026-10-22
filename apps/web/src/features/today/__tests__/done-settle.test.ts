import { describe, expect, it } from "vitest";
import {
  cancelSettle,
  clearAnim,
  clearArrival,
  dropStaleSettles,
  EMPTY_SETTLE,
  endVoteHold,
  extendSettleDeadline,
  finishLeaving,
  getCardMotion,
  getSettleDelay,
  getSettlingIds,
  getVoteHold,
  isVoteShowing,
  planSettle,
  type SettleState,
  startComplete,
  startLeaving,
  startUndo,
  type VoteMark,
} from "../done-settle";

const allDone = () => true;
const vote = (valueId = "v1", isRepeat = false): VoteMark => ({ valueId, isRepeat });

function completed(...entries: Array<[string, boolean]>): SettleState {
  return entries.reduce(
    (state, [id, hasVote]) => startComplete(state, id, hasVote ? vote() : null),
    EMPTY_SETTLE,
  );
}

describe("getSettleDelay", () => {
  it("waits longer when a vote is showing, and a card longer than a slim row", () => {
    expect(getSettleDelay(true, "card")).toBe(2900);
    expect(getSettleDelay(true, "compact")).toBe(2100);
    expect(getSettleDelay(false, "card")).toBe(1200);
    expect(getSettleDelay(false, "compact")).toBe(1200);
  });
});

describe("getVoteHold", () => {
  it("holds a card's message 2.1s and a slim row's 1.5s", () => {
    expect(getVoteHold("card")).toBe(2100);
    expect(getVoteHold("compact")).toBe(1500);
  });
});

describe("extendSettleDeadline", () => {
  it("starts a deadline when none is pending", () => {
    expect(extendSettleDeadline(null, 1000, 2100)).toBe(3100);
  });

  it("waits for the slowest row: a quicker complete never pulls the batch earlier", () => {
    expect(extendSettleDeadline(2900, 500, 2100)).toBe(2900);
    expect(extendSettleDeadline(2900, 1000, 2900)).toBe(3900);
  });
});

describe("isVoteShowing", () => {
  it("is true while a row of that value is in its vote", () => {
    const state = startComplete(EMPTY_SETTLE, "a", vote("health"));
    expect(isVoteShowing(state, "health")).toBe(true);
    expect(isVoteShowing(state, "growth")).toBe(false);
  });

  it("is false once that vote has ended or was undone", () => {
    const state = startComplete(EMPTY_SETTLE, "a", vote("health"));
    expect(isVoteShowing(endVoteHold(state, "a"), "health")).toBe(false);
    expect(isVoteShowing(startUndo(state, "a"), "health")).toBe(false);
  });
});

describe("repeat votes", () => {
  const repeat = startComplete(EMPTY_SETTLE, "b", vote("health", true));

  it("marks the row's motion as a repeat", () => {
    expect(getCardMotion(repeat, "b")?.isRepeatVote).toBe(true);
  });

  it("keeps the mark through the vote's end and an undo, so the headline holds while it fades", () => {
    expect(getCardMotion(endVoteHold(repeat, "b"), "b")?.isRepeatVote).toBe(true);
    expect(getCardMotion(startUndo(repeat, "b"), "b")?.isRepeatVote).toBe(true);
  });

  it("forgets the mark once the row lands, is cancelled, or its undo settles", () => {
    const ended = endVoteHold(repeat, "b");
    const landed = finishLeaving(startLeaving(ended, ["b"]), ["b"]);
    expect(getCardMotion(landed, "b")?.isRepeatVote).toBe(false);
    expect(cancelSettle(ended, "b").votes.has("b")).toBe(false);
    expect(clearAnim(startUndo(ended, "b"), "b", "undo").votes.has("b")).toBe(false);
  });

  it("drops the mark when the row completes again with no vote", () => {
    expect(startComplete(startUndo(repeat, "b"), "b", null).votes.has("b")).toBe(false);
  });
});

describe("startComplete", () => {
  it("holds a valued complete in its vote and plays the complete animation", () => {
    const state = completed(["a", true]);
    expect(state.phases.get("a")).toBe("vote");
    expect(getCardMotion(state, "a")).toEqual({
      anim: "complete",
      isVoting: true,
      isRepeatVote: false,
      travel: null,
    });
  });

  it("holds an unvalued complete straight in post", () => {
    const state = completed(["a", false]);
    expect(state.phases.get("a")).toBe("post");
    expect(getCardMotion(state, "a")?.isVoting).toBe(false);
  });

  it("stops an arriving row's arrival", () => {
    const arriving = startUndo(EMPTY_SETTLE, "a");
    expect(arriving.arriving.has("a")).toBe(true);
    expect(startComplete(arriving, "a", null).arriving.has("a")).toBe(false);
  });

  it("does not mutate the previous state", () => {
    const before = completed(["a", true]);
    startComplete(before, "b", vote());
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
    expect(getCardMotion(state, "a")).toEqual({
      anim: "undo",
      isVoting: false,
      isRepeatVote: false,
      travel: null,
    });
  });

  it("brings a row undone from Done back with the arrive animation", () => {
    const state = startUndo(EMPTY_SETTLE, "a");
    expect(getCardMotion(state, "a")).toEqual({
      anim: "undo",
      isVoting: false,
      isRepeatVote: false,
      travel: "arrive",
    });
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
    const recompleted = startComplete(undone, "a", null);
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
    expect(getCardMotion(moved, "a")).toEqual({
      anim: null,
      isVoting: false,
      isRepeatVote: false,
      travel: "arrive",
    });

    expect(getCardMotion(clearArrival(moved, ["a"]), "a")).toBeUndefined();
  });

  it("skips a row undone between leave and move", () => {
    const leaving = startLeaving(completed(["a", false]), ["a"]);
    const undone = startUndo(leaving, "a");
    const moved = finishLeaving(undone, ["a"]);
    expect(getCardMotion(moved, "a")).toEqual({
      anim: "undo",
      isVoting: false,
      isRepeatVote: false,
      travel: null,
    });
  });
});

describe("getSettlingIds", () => {
  it("is every row held in Remaining", () => {
    const state = completed(["a", true], ["b", false]);
    expect([...getSettlingIds(state)]).toEqual(["a", "b"]);
    expect(getSettlingIds(EMPTY_SETTLE).size).toBe(0);
  });
});
