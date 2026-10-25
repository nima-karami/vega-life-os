import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { classifyOsvFindings } from "../lib/osv-severity.mjs";

function buildReport(group, vulnerabilities = []) {
  return {
    results: [
      {
        packages: [
          {
            package: { name: "example-pkg", version: "1.2.3" },
            vulnerabilities,
            groups: [group],
          },
        ],
      },
    ],
  };
}

function buildGhsaVulnerability(id, severity) {
  return { id, database_specific: { severity } };
}

describe("classifyOsvFindings", () => {
  it("a 2.1 Low finding warns and does not block", () => {
    const report = buildReport({ ids: ["GHSA-aaaa"], max_severity: "2.1" });
    const { blocking, warnings } = classifyOsvFindings(report);
    assert.equal(blocking.length, 0);
    assert.equal(warnings[0].label, "low");
  });

  it("a 7.5 finding blocks as high", () => {
    const report = buildReport({ ids: ["GHSA-aaaa"], max_severity: "7.5" });
    const { blocking } = classifyOsvFindings(report);
    assert.equal(blocking[0].label, "high");
    assert.equal(blocking[0].score, 7.5);
    assert.equal(blocking[0].packageName, "example-pkg");
    assert.equal(blocking[0].packageVersion, "1.2.3");
  });

  it("a 9.8 finding blocks as critical", () => {
    const report = buildReport({ ids: ["GHSA-aaaa"], max_severity: "9.8" });
    assert.equal(classifyOsvFindings(report).blocking[0].label, "critical");
  });

  it("an unscored group falls back to the GHSA label", () => {
    const report = buildReport({ ids: ["GHSA-aaaa"], max_severity: "" }, [
      buildGhsaVulnerability("GHSA-aaaa", "MODERATE"),
    ]);
    const { blocking, warnings } = classifyOsvFindings(report);
    assert.equal(blocking.length, 0);
    assert.equal(warnings[0].label, "medium");
  });

  it("an ungradeable finding blocks as unknown", () => {
    const report = buildReport({ ids: ["GHSA-aaaa"], max_severity: "" }, [{ id: "GHSA-aaaa" }]);
    const { blocking } = classifyOsvFindings(report);
    assert.equal(blocking[0].label, "unknown");
    assert.equal(blocking[0].score, undefined);
  });

  it("one finding per group, not per alias", () => {
    const report = buildReport({ ids: ["GHSA-aaaa", "CVE-2026-0001"], max_severity: "5.0" }, [
      buildGhsaVulnerability("GHSA-aaaa", "MODERATE"),
      buildGhsaVulnerability("CVE-2026-0001", "MODERATE"),
    ]);
    const { blocking, warnings } = classifyOsvFindings(report);
    assert.equal(blocking.length + warnings.length, 1);
    assert.equal(warnings[0].id, "GHSA-aaaa");
  });

  it("a non-report throws", () => {
    assert.throws(() => classifyOsvFindings(null), /not an osv-scanner JSON report/);
    assert.throws(() => classifyOsvFindings({}), /not an osv-scanner JSON report/);
  });
});
