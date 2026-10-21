import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const WINDOWS_NATIVE = /^(.*)-(?:win32|windows)-x64(-msvc|-gnu)?$/;

function findMissingLinuxSiblings(lockPackages) {
  const missing = [];
  for (const lockPath of Object.keys(lockPackages)) {
    const match = WINDOWS_NATIVE.exec(lockPath);
    if (!match) continue;
    const [, stem, abiSuffix] = match;
    const linuxPath = `${stem}-linux-x64${abiSuffix ? "-gnu" : ""}`;
    if (!(linuxPath in lockPackages)) missing.push({ lockPath, linuxPath });
  }
  return missing;
}

const lockfilePath = resolve(process.argv[2] ?? "package-lock.json");
const lockfile = JSON.parse(readFileSync(lockfilePath, "utf8"));
const missing = findMissingLinuxSiblings(lockfile.packages ?? {});

if (missing.length > 0) {
  console.error(`${lockfilePath} is missing linux-x64 native builds (npm/cli#4828):`);
  for (const { lockPath, linuxPath } of missing) console.error(`  ${lockPath} has no ${linuxPath}`);
  console.error(
    "Regenerate it on npm >= 11.3: delete package-lock.json and every node_modules, then npm install.",
  );
  process.exit(1);
}

console.log(`${lockfilePath}: every win32-x64 native package has a linux-x64 sibling.`);
