import { describe, expect, it } from "vitest";
import type { Goal } from "../model";
import {
  canActivate,
  coerceStatus,
  goalPaceBadge,
  goalProgressIsDerived,
  goalProgressPercent,
  goalScheduleBadge,
  statusChangePatch,
} from "../presentation";

const baseGoal = (over: Partial<Goal> = {}): Goal => ({
  id: "g1",
  valueId: "v1",
  name: "Goal",
  icon: "target",
  status: "active",
  start: "2026-01-01",
  end: "2026-12-31",
  progress: 0,
  subgoals: [],
  order: 0,
  ...over,
});

describe("goalProgressPercent", () => {
  it("rounds a 0..1 fraction to an integer percent", () => {
    expect(goalProgressPercent(baseGoal({ progress: 0.25 }))).toBe(25);
    expect(goalProgressPercent(baseGoal({ progress: 0.555 }))).toBe(56);
    expect(goalProgressPercent(baseGoal({ progress: 0 }))).toBe(0);
    expect(goalProgressPercent(baseGoal({ progress: 1 }))).toBe(100);
  });
});

describe("goalProgressIsDerived", () => {
  it("is derived (read-only) when the goal has subgoals", () => {
    expect(
      goalProgressIsDerived(baseGoal({ subgoals: [{ id: "s1", name: "a", done: false }] })),
    ).toBe(true);
  });

  it("is manual (settable) when there are no subgoals", () => {
    expect(goalProgressIsDerived(baseGoal({ subgoals: [] }))).toBe(false);
  });
});

describe("goalPaceBadge", () => {
  it("returns null for closed goals (done/abandoned)", () => {
    expect(goalPaceBadge(baseGoal({ status: "done" }), "2026-07-02")).toBeNull();
    expect(goalPaceBadge(baseGoal({ status: "abandoned" }), "2026-07-02")).toBeNull();
  });

  it("returns null outside the current phase (upcoming or ended)", () => {
    expect(
      goalPaceBadge(baseGoal({ start: "2030-01-01", end: "2030-12-31" }), "2026-07-02"),
    ).toBeNull();
    expect(
      goalPaceBadge(baseGoal({ start: "2020-01-01", end: "2020-12-31" }), "2026-07-02"),
    ).toBeNull();
  });

  it("reports on-pace when progress is at or ahead of elapsed time", () => {
    // window 2026 (current at 2026-07-02 ≈ half elapsed), progress 1 => ahead
    const badge = goalPaceBadge(
      baseGoal({ start: "2026-01-01", end: "2026-12-31", progress: 1, status: "active" }),
      "2026-07-02",
    );
    expect(badge).toEqual({ behind: false, text: "on pace" });
  });

  it("reports how far behind when progress trails elapsed time", () => {
    // ~50% elapsed, 0 progress => 50% behind
    const badge = goalPaceBadge(
      baseGoal({ start: "2026-01-01", end: "2026-12-31", progress: 0, status: "active" }),
      "2026-07-02",
    );
    expect(badge).toEqual({ behind: true, text: "50% behind" });
  });
});

describe("canActivate", () => {
  it("is false while the goal's period is upcoming", () => {
    expect(canActivate(baseGoal({ start: "2030-01-01", end: "2030-12-31" }), "2026-07-02")).toBe(
      false,
    );
  });
  it("is true for current and ended goals", () => {
    expect(canActivate(baseGoal({ start: "2026-01-01", end: "2026-12-31" }), "2026-07-02")).toBe(
      true,
    );
    expect(canActivate(baseGoal({ start: "2020-01-01", end: "2020-12-31" }), "2026-07-02")).toBe(
      true,
    );
  });
});

describe("coerceStatus", () => {
  it("forces active/paused to backlog only while upcoming", () => {
    expect(coerceStatus("active", "upcoming")).toBe("backlog");
    expect(coerceStatus("paused", "upcoming")).toBe("backlog");
  });
  it("leaves backlog and closed statuses unchanged while upcoming", () => {
    expect(coerceStatus("backlog", "upcoming")).toBe("backlog");
    expect(coerceStatus("done", "upcoming")).toBe("done");
    expect(coerceStatus("abandoned", "upcoming")).toBe("abandoned");
  });
  it("is the identity for current and ended phases", () => {
    expect(coerceStatus("active", "current")).toBe("active");
    expect(coerceStatus("active", "ended")).toBe("active");
    expect(coerceStatus("paused", "ended")).toBe("paused");
  });
});

describe("goalScheduleBadge", () => {
  it("shows a Scheduled badge with the period for upcoming goals", () => {
    const badge = goalScheduleBadge(
      baseGoal({ start: "2030-07-01", end: "2030-09-30" }),
      "2026-07-02",
    );
    expect(badge).toEqual({ kind: "scheduled", text: "Scheduled · Q3 2030" });
  });
  it("shows Ready to start for a current backlog goal", () => {
    const badge = goalScheduleBadge(
      baseGoal({ start: "2026-01-01", end: "2026-12-31", status: "backlog" }),
      "2026-07-02",
    );
    expect(badge).toEqual({ kind: "ready", text: "Ready to start" });
  });
  it("shows Overdue for an ended goal that is not closed", () => {
    const badge = goalScheduleBadge(
      baseGoal({ start: "2020-01-01", end: "2020-12-31", status: "active" }),
      "2026-07-02",
    );
    expect(badge).toEqual({ kind: "overdue", text: "Overdue" });
  });
  it("shows no badge for a current active goal, or a closed ended goal", () => {
    expect(
      goalScheduleBadge(
        baseGoal({ start: "2026-01-01", end: "2026-12-31", status: "active" }),
        "2026-07-02",
      ),
    ).toBeNull();
    expect(
      goalScheduleBadge(
        baseGoal({ start: "2020-01-01", end: "2020-12-31", status: "done" }),
        "2026-07-02",
      ),
    ).toBeNull();
  });
});

describe("statusChangePatch", () => {
  it("forces progress to 1 when moving to done", () => {
    expect(statusChangePatch("done")).toEqual({ status: "done", progress: 1 });
  });

  it("leaves progress untouched for non-done statuses", () => {
    expect(statusChangePatch("abandoned")).toEqual({ status: "abandoned" });
    expect(statusChangePatch("active")).toEqual({ status: "active" });
    expect(statusChangePatch("backlog")).toEqual({ status: "backlog" });
    expect(statusChangePatch("paused")).toEqual({ status: "paused" });
  });
});
