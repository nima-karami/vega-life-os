const BOTH = ["server", "hosting"];

// First match wins. The server image installs every workspace manifest (apps/server/Dockerfile),
// so apps/web/package.json reaches the server too.
const FILE_RULES = [
  { rule: "docs", targets: [], matches: (filePath) => isDocsPath(filePath) },
  {
    rule: "release-pipeline",
    targets: BOTH,
    matches: (filePath) => filePath === ".github/workflows/release.yml",
  },
  {
    rule: "server-deploy",
    targets: ["server"],
    matches: (filePath) =>
      filePath === "scripts/deploy-server.sh" || filePath === "cloudbuild.server.yaml",
  },
  {
    rule: "manifest",
    targets: BOTH,
    matches: (filePath) =>
      ["package.json", "package-lock.json", "apps/web/package.json"].includes(filePath),
  },
  { rule: "shared", targets: BOTH, matches: (filePath) => filePath.startsWith("packages/shared/") },
  { rule: "web", targets: ["hosting"], matches: (filePath) => filePath.startsWith("apps/web/") },
  {
    rule: "server",
    targets: ["server"],
    matches: (filePath) => filePath.startsWith("apps/server/"),
  },
  {
    rule: "hosting-config",
    targets: ["hosting"],
    matches: (filePath) => filePath === "firebase.json" || filePath === ".firebaserc",
  },
  { rule: "tooling", targets: [], matches: (filePath) => isToolingPath(filePath) },
];

const TOOLING_PREFIXES = ["scripts/", ".github/", ".husky/", "infra/"];
const TOOLING_FILES = [
  "biome.json",
  "knip.json",
  "tsconfig.json",
  ".gitignore",
  ".gitattributes",
  ".nvmrc",
  ".env.example",
  "firestore.rules",
];

function isSlicePath(filePath) {
  return filePath.startsWith("apps/") || filePath.startsWith("packages/");
}

function isDocsPath(filePath) {
  if (isSlicePath(filePath)) return false;
  return (
    filePath.startsWith("docs/") || filePath.startsWith(".claude/") || filePath.endsWith(".md")
  );
}

function isToolingPath(filePath) {
  return (
    TOOLING_FILES.includes(filePath) ||
    TOOLING_PREFIXES.some((prefix) => filePath.startsWith(prefix))
  );
}

export function classifyChangedFile(filePath) {
  const match = FILE_RULES.find((candidate) => candidate.matches(filePath));
  return match ? { rule: match.rule, targets: match.targets } : { rule: "unknown", targets: BOTH };
}

export function isCommitSha(value) {
  return typeof value === "string" && /^[0-9a-f]{7,40}$/.test(value);
}

function describeOverride(target, only) {
  const shouldDeploy = only === "both" || only === target;
  return {
    target,
    shouldDeploy,
    reason: shouldDeploy ? `forced by --only=${only}` : `skipped by --only=${only}`,
    relevantFiles: [],
    changedFileCount: 0,
  };
}

export function planTarget({ target, liveSha, changedFiles, only }) {
  if (only) return describeOverride(target, only);
  const base = { target, relevantFiles: [], changedFileCount: 0 };
  if (!isCommitSha(liveSha)) {
    return { ...base, shouldDeploy: true, reason: `live sha unknown (${liveSha || "none"})` };
  }
  if (!changedFiles) {
    return { ...base, shouldDeploy: true, reason: `live sha ${liveSha} is not in git history` };
  }
  if (changedFiles.length === 0) {
    return { ...base, shouldDeploy: false, reason: `HEAD is already live (${liveSha})` };
  }
  const relevantFiles = changedFiles.filter((filePath) =>
    classifyChangedFile(filePath).targets.includes(target),
  );
  const shouldDeploy = relevantFiles.length > 0;
  const reason = shouldDeploy
    ? `${relevantFiles.length} of ${changedFiles.length} files changed since ${liveSha} affect it`
    : `none of ${changedFiles.length} files changed since ${liveSha} affect it`;
  return { ...base, shouldDeploy, reason, relevantFiles, changedFileCount: changedFiles.length };
}

export function classifyCiScope(changedFiles) {
  if (!changedFiles || changedFiles.length === 0) return "full";
  if (changedFiles.every(isDocsPath)) return "docs";
  const isWebOrDocs = (filePath) => isDocsPath(filePath) || filePath.startsWith("apps/web/");
  return changedFiles.every(isWebOrDocs) ? "web" : "full";
}
