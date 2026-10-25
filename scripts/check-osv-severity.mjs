import { readFileSync } from "node:fs";
import { classifyOsvFindings } from "./lib/osv-severity.mjs";

const IS_GITHUB_ACTIONS = Boolean(process.env.GITHUB_ACTIONS);

function readReportText() {
  const reportPath = process.argv[2];
  return readFileSync(reportPath ?? 0, "utf8");
}

function describeFinding(finding) {
  const score = finding.score ?? "unscored";
  return `${finding.id} in ${finding.packageName}@${finding.packageVersion} (${score})`;
}

function printFinding(level, finding) {
  if (IS_GITHUB_ACTIONS) {
    console.log(`::${level} title=OSV ${finding.label}::${describeFinding(finding)}`);
    return;
  }
  console.log(`osv ${level}: ${finding.label} ${describeFinding(finding)}`);
}

function main() {
  let classified;
  try {
    classified = classifyOsvFindings(JSON.parse(readReportText()));
  } catch {
    console.log("osv: FAILED — no OSV report (did osv-scanner run?)");
    process.exitCode = 1;
    return;
  }
  const { blocking, warnings } = classified;
  for (const finding of warnings) printFinding("warning", finding);
  for (const finding of blocking) printFinding("error", finding);
  console.log(`osv: ${blocking.length} blocking, ${warnings.length} warnings`);
  if (blocking.length > 0) process.exitCode = 1;
}

main();
