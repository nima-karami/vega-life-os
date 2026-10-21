import { GLOBAL_SHORTCUTS, GO_SHORTCUTS } from "./keymap";

// The weekly review shares the /analytics page under ?tab=review and stays reachable.
const QUIET_HIDDEN_PATHS = new Set(["/analytics"]);

const isHiddenWhenQuiet = (to: string): boolean => QUIET_HIDDEN_PATHS.has(to);

export function filterQuietRoutes<T extends { to?: string }>(items: T[], isQuiet: boolean): T[] {
  if (!isQuiet) return items;
  return items.filter((item) => item.to === undefined || !isHiddenWhenQuiet(item.to));
}

export function listHelpShortcuts(isQuiet: boolean): typeof GLOBAL_SHORTCUTS {
  const goKeys = new Set(filterQuietRoutes(GO_SHORTCUTS, isQuiet).map((s) => `g ${s.key}`));
  return GLOBAL_SHORTCUTS.filter((row) => !row.keys.startsWith("g ") || goKeys.has(row.keys));
}
