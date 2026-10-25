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
const DEPLOY_HEADING = "### Deploy";
const DEPLOY_HEADING_LINE = /^### Deploy$/gm;
const BREAK_GLASS_LINE = "- Path: **break-glass** (laptop release; Semgrep did not run)";
const FIRST_RELEASE_BODY = "First versioned release. Earlier history: the git log.";
// A code span or a bare @mention (not an email); only the mention is rewritten.
const CODE_SPAN_OR_MENTION = /`[^`]*`|(?<![\w`])@[\w./-]*\w/g;

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

function neutraliseMentions(text) {
  return text.replace(CODE_SPAN_OR_MENTION, (match) =>
    match.startsWith("`") ? match : `\`${match}\``,
  );
}

function formatChangeLine({ sha, scope, description, isBreaking }) {
  const scopePrefix = scope ? `**${scope}:** ` : "";
  const breakingPrefix = isBreaking ? "**breaking:** " : "";
  return `- ${scopePrefix}${breakingPrefix}${neutraliseMentions(description)} (${sha})`;
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

function describeChanges(previousTag, commits) {
  if (!previousTag) return [FIRST_RELEASE_BODY];
  const sections = groupChanges(commits);
  const changeCount = sections.reduce((total, section) => total + section.lines.length, 0);
  if (changeCount === 0) return [`No commits since \`${previousTag}\`.`];
  const commitWord = changeCount === 1 ? "commit" : "commits";
  return [
    `${changeCount} ${commitWord} since \`${previousTag}\`.`,
    ...sections.map(({ title, lines }) => `### ${title}\n\n${lines.join("\n")}`),
  ];
}

export function buildReleaseNotes({ previousTag, commits, manifest }) {
  const body = describeChanges(previousTag, commits);
  return `${[...body, ...(manifest ? [manifest] : [])].join("\n\n")}\n`;
}

function describeSkipped({ reason }) {
  return reason ? `skipped (${reason})` : "skipped";
}

function describeServer(server) {
  if (server.status !== "shipped") return describeSkipped(server);
  const details = [
    server.revision && `revision \`${server.revision}\``,
    server.image && `image \`${server.image}\``,
  ].filter(Boolean);
  return ["shipped", ...details].join(", ");
}

function describeHosting(hosting, sha) {
  if (hosting.status !== "shipped") return describeSkipped(hosting);
  const version = hosting.hostingVersion ? `, version \`${hosting.hostingVersion}\`` : "";
  return `shipped, build \`${sha}\`${version}`;
}

export function buildDeployManifest({ sha, server, hosting, schemaHash, runUrl, isBreakGlass }) {
  const lines = [
    isBreakGlass && BREAK_GLASS_LINE,
    `- Server: ${describeServer(server)}`,
    `- Hosting: ${describeHosting(hosting, sha)}`,
    schemaHash && `- Schema hash: \`${schemaHash}\``,
    `- Commit: \`${sha}\``,
    runUrl && `- Run: ${runUrl}`,
  ].filter(Boolean);
  return `${DEPLOY_HEADING}\n\n${lines.join("\n")}`;
}

function parseTargetLine(deploySection, label, idLabel) {
  const line = deploySection.match(new RegExp(`^- ${label}: (.*)$`, "m"))?.[1] ?? "";
  const isShipped = line.startsWith("shipped");
  const id = isShipped ? line.match(new RegExp(`${idLabel} \`([^\`]+)\``))?.[1] : undefined;
  return { isShipped, id };
}

export function parseDeployManifest(notes) {
  const normalizedNotes = notes.replace(/\r\n/g, "\n");
  const lastHeading = [...normalizedNotes.matchAll(DEPLOY_HEADING_LINE)].at(-1);
  const deploySection = lastHeading
    ? normalizedNotes.slice(lastHeading.index + lastHeading[0].length)
    : "";
  const server = parseTargetLine(deploySection, "Server", "revision");
  const hosting = parseTargetLine(deploySection, "Hosting", "version");
  return {
    server: { isShipped: server.isShipped, revision: server.id },
    hosting: { isShipped: hosting.isShipped, hostingVersion: hosting.id },
  };
}
