export const BLOCKING_SCORE = 7.0;

const CRITICAL_SCORE = 9.0;
const MEDIUM_SCORE = 4.0;

const GHSA_LABELS = {
  CRITICAL: "critical",
  HIGH: "high",
  MODERATE: "medium",
  LOW: "low",
};

const BLOCKING_LABELS = new Set(["critical", "high", "unknown"]);

function labelScore(score) {
  if (score >= CRITICAL_SCORE) return "critical";
  if (score >= BLOCKING_SCORE) return "high";
  if (score >= MEDIUM_SCORE) return "medium";
  return "low";
}

function findGhsaLabel(group, vulnerabilities) {
  const grouped = vulnerabilities.filter((vulnerability) => group.ids.includes(vulnerability.id));
  for (const vulnerability of grouped) {
    const label = GHSA_LABELS[vulnerability.database_specific?.severity];
    if (label) return label;
  }
  return "unknown";
}

function buildFinding(group, osvPackage) {
  const { name, version } = osvPackage.package;
  const base = { id: group.ids[0], packageName: name, packageVersion: version };
  const score = Number.parseFloat(group.max_severity);
  if (Number.isNaN(score)) {
    return {
      ...base,
      score: undefined,
      label: findGhsaLabel(group, osvPackage.vulnerabilities ?? []),
    };
  }
  return { ...base, score, label: labelScore(score) };
}

export function classifyOsvFindings(report) {
  if (!Array.isArray(report?.results)) throw new Error("not an osv-scanner JSON report");
  const blocking = [];
  const warnings = [];
  for (const result of report.results) {
    for (const osvPackage of result.packages ?? []) {
      for (const group of osvPackage.groups ?? []) {
        const finding = buildFinding(group, osvPackage);
        (BLOCKING_LABELS.has(finding.label) ? blocking : warnings).push(finding);
      }
    }
  }
  return { blocking, warnings };
}
