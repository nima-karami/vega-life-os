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

// A vulnerability no group grades is not a pass: it fails closed as unknown.
function buildUngroupedFindings(osvPackage) {
  const groups = osvPackage.groups ?? [];
  const groupedIds = new Set(groups.flatMap((group) => [...group.ids, ...(group.aliases ?? [])]));
  const { name, version } = osvPackage.package;
  return (osvPackage.vulnerabilities ?? [])
    .filter((vulnerability) => !groupedIds.has(vulnerability.id))
    .map((vulnerability) => ({
      id: vulnerability.id,
      packageName: name,
      packageVersion: version,
      score: undefined,
      label: "unknown",
    }));
}

function buildPackageFindings(osvPackage) {
  const groupFindings = (osvPackage.groups ?? []).map((group) => buildFinding(group, osvPackage));
  return [...groupFindings, ...buildUngroupedFindings(osvPackage)];
}

export function classifyOsvFindings(report) {
  if (!Array.isArray(report?.results)) throw new Error("not an osv-scanner JSON report");
  const findings = report.results.flatMap((result) =>
    (result.packages ?? []).flatMap(buildPackageFindings),
  );
  return {
    blocking: findings.filter((finding) => BLOCKING_LABELS.has(finding.label)),
    warnings: findings.filter((finding) => !BLOCKING_LABELS.has(finding.label)),
  };
}
