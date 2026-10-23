const CONVENTIONAL_SUBJECT = /^(\w+)(?:\(([^)]*)\))?(!)?:\s*(.+)$/;
const GIT_MERGE_SUBJECT = /^Merge (branch|pull request|remote-tracking branch|tag) /;

const SECTIONS = [
  { type: "feat", title: "Features" },
  { type: "fix", title: "Fixes" },
  { type: "perf", title: "Performance" },
  { type: "refactor", title: "Refactoring" },
  { type: "revert", title: "Reverts" },
  { type: "docs", title: "Documentation" },
  { type: "test", title: "Tests" },
  { type: "build", title: "Build" },
  { type: "ci", title: "CI" },
  { type: "chore", title: "Chores" },
];
const OTHER_SECTION = "Other";

export function parseCommitSubject(subject) {
  if (subject.startsWith('Revert "')) {
    return { type: "revert", scope: undefined, description: subject, isBreaking: false };
  }
  const match = CONVENTIONAL_SUBJECT.exec(subject);
  if (!match) return { type: undefined, scope: undefined, description: subject, isBreaking: false };
  const [, type, scope, bang, description] = match;
  return { type: type.toLowerCase(), scope: scope || undefined, description, isBreaking: !!bang };
}

function isMergeCommit(subject, type) {
  return type === "merge" || GIT_MERGE_SUBJECT.test(subject);
}

function formatChangeLine({ sha, scope, description, isBreaking }) {
  const scopePrefix = scope ? `**${scope}:** ` : "";
  const breakingPrefix = isBreaking ? "**breaking:** " : "";
  return `- ${scopePrefix}${breakingPrefix}${description} (${sha})`;
}

function groupChanges(commits) {
  const linesBySection = new Map();
  for (const { sha, subject } of commits) {
    const parsed = parseCommitSubject(subject);
    if (isMergeCommit(subject, parsed.type)) continue;
    const section = SECTIONS.find((candidate) => candidate.type === parsed.type);
    const title = section?.title ?? OTHER_SECTION;
    linesBySection.set(title, [
      ...(linesBySection.get(title) ?? []),
      formatChangeLine({ sha, ...parsed }),
    ]);
  }
  const order = [...SECTIONS.map((section) => section.title), OTHER_SECTION];
  return order
    .filter((title) => linesBySection.has(title))
    .map((title) => ({ title, lines: linesBySection.get(title) }));
}

function describeRange(previousTag, changeCount) {
  const commitWord = changeCount === 1 ? "commit" : "commits";
  return previousTag
    ? `${changeCount} ${commitWord} since \`${previousTag}\`.`
    : `${changeCount} ${commitWord}, the first release.`;
}

export function buildReleaseNotes({ previousTag, commits, manifest }) {
  const sections = groupChanges(commits);
  const changeCount = sections.reduce((total, section) => total + section.lines.length, 0);
  const body =
    changeCount === 0
      ? [`No commits since \`${previousTag ?? "the root"}\`.`]
      : [
          describeRange(previousTag, changeCount),
          ...sections.map(({ title, lines }) => `### ${title}\n\n${lines.join("\n")}`),
        ];
  return `${[...body, ...(manifest ? [manifest] : [])].join("\n\n")}\n`;
}

function describeServer(server) {
  if (server.status !== "shipped") return `skipped (${server.reason ?? "unchanged since live"})`;
  const details = [
    server.revision && `revision \`${server.revision}\``,
    server.image && `image \`${server.image}\``,
  ].filter(Boolean);
  return ["shipped", ...details].join(", ");
}

function describeHosting(hosting, sha) {
  if (hosting.status !== "shipped") return `skipped (${hosting.reason ?? "unchanged since live"})`;
  return `shipped, build \`${sha}\``;
}

export function buildDeployManifest({ sha, server, hosting, schemaHash, runUrl }) {
  const lines = [
    `- Server: ${describeServer(server)}`,
    `- Hosting: ${describeHosting(hosting, sha)}`,
    schemaHash && `- Schema hash: \`${schemaHash}\``,
    `- Commit: \`${sha}\``,
    runUrl && `- Run: ${runUrl}`,
  ].filter(Boolean);
  return `### Deploy\n\n${lines.join("\n")}`;
}
