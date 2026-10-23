// CalVer vYYYY.M.N: N is the nth release of that UTC month. See docs/adr/2026-10-22-0005-calendar-versioning.md.
const VERSION_TAG = /^v(\d{4})\.([1-9]\d?)\.([1-9]\d*)$/;

export function parseVersionTag(tag) {
  const match = VERSION_TAG.exec(tag);
  if (!match) return undefined;
  const [year, month, count] = match.slice(1).map(Number);
  return month <= 12 ? { year, month, count } : undefined;
}

export function compareVersionTags(left, right) {
  const a = parseVersionTag(left);
  const b = parseVersionTag(right);
  return a.year - b.year || a.month - b.month || a.count - b.count;
}

export function nextVersion(existingTags, now) {
  const year = now.getUTCFullYear();
  const month = now.getUTCMonth() + 1;
  const releasedThisMonth = existingTags
    .map(parseVersionTag)
    .filter((version) => version?.year === year && version.month === month)
    .map((version) => version.count);
  return `v${year}.${month}.${Math.max(0, ...releasedThisMonth) + 1}`;
}
