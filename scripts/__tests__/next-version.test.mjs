import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compareVersionTags, nextVersion, parseVersionTag } from "../lib/next-version.mjs";

const OCT_22 = new Date("2026-10-22T12:00:00Z");

describe("parseVersionTag", () => {
  it("reads year, month and count from a release tag", () => {
    assert.deepEqual(parseVersionTag("v2026.10.3"), { year: 2026, month: 10, count: 3 });
    assert.deepEqual(parseVersionTag("v2027.1.12"), { year: 2027, month: 1, count: 12 });
  });

  it("rejects anything that is not a release tag", () => {
    for (const tag of [
      "archive/paper-wip",
      "v2026.010.1",
      "v2026.10.0",
      "v2026.13.1",
      "v2026.0.1",
      "v2026.10.01",
      "2026.10.1",
      "v2026.10.1-rc1",
      "v1.2.3",
      "",
    ]) {
      assert.equal(parseVersionTag(tag), undefined, tag);
    }
  });
});

describe("nextVersion", () => {
  it("starts a month at 1", () => {
    assert.equal(nextVersion([], OCT_22), "v2026.10.1");
    assert.equal(nextVersion(["archive/paper-wip"], OCT_22), "v2026.10.1");
  });

  it("counts past the highest release of the same month", () => {
    assert.equal(nextVersion(["v2026.10.1", "v2026.10.2"], OCT_22), "v2026.10.3");
    assert.equal(nextVersion(["v2026.10.9", "v2026.10.10"], OCT_22), "v2026.10.11");
    assert.equal(nextVersion(["v2026.10.2", "v2026.10.5"], OCT_22), "v2026.10.6");
  });

  it("resets when the month or year changes", () => {
    assert.equal(nextVersion(["v2026.9.4"], OCT_22), "v2026.10.1");
    assert.equal(nextVersion(["v2025.10.4"], OCT_22), "v2026.10.1");
    assert.equal(nextVersion(["v2026.12.7"], new Date("2027-01-01T00:00:00Z")), "v2027.1.1");
  });

  it("ignores tags that only look close to a release", () => {
    assert.equal(
      nextVersion(["v2026.10.04", "v2026.10.9-rc1", "v2026.10.x"], OCT_22),
      "v2026.10.1",
    );
  });

  it("reads the month in UTC, not local time", () => {
    assert.equal(nextVersion([], new Date("2026-10-31T23:30:00-05:00")), "v2026.11.1");
    assert.equal(nextVersion([], new Date("2026-11-01T01:00:00+05:00")), "v2026.10.1");
  });
});

describe("compareVersionTags", () => {
  it("orders by year, month, then count, not as strings", () => {
    const sorted = ["v2026.10.2", "v2026.9.10", "v2026.10.10", "v2025.12.1"].sort(
      compareVersionTags,
    );
    assert.deepEqual(sorted, ["v2025.12.1", "v2026.9.10", "v2026.10.2", "v2026.10.10"]);
  });
});
