import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

// Baseline of pre-existing suppressions ("file:line"). It can only shrink: stale entries fail too.
const ALLOWED = [
  "apps/web/src/app/commands.ts:264",
  "apps/web/src/core/ui/contextmenu.tsx:310",
  "apps/web/src/features/journal/components/MoodPicker.tsx:17",
  "apps/web/src/features/values/components/editor-bits.tsx:22",
];

const PATTERN = /biome-ignore|eslint-disable|@ts-ignore|@ts-expect-error|jscpd:ignore/;
const SOURCE = /\.(?:[cm]?[jt]sx?|css)$/;

const files = execFileSync("git", ["ls-files", "apps", "packages"], { encoding: "utf8" })
  .split("\n")
  .filter((f) => f && SOURCE.test(f));

const found = [];
for (const file of files) {
  let text;
  try {
    text = readFileSync(file, "utf8");
  } catch {
    continue;
  }
  text.split("\n").forEach((line, i) => {
    if (PATTERN.test(line)) found.push(`${file}:${i + 1}`);
  });
}

const added = found.filter((f) => !ALLOWED.includes(f));
const stale = ALLOWED.filter((f) => !found.includes(f));

if (added.length || stale.length) {
  for (const f of added) console.error(`new suppression: ${f}`);
  for (const f of stale) console.error(`stale allowlist entry (remove it): ${f}`);
  process.exit(1);
}
console.log(`suppressions: ${found.length} baseline, none new`);
