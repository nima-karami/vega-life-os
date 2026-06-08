export interface GoShortcut {
  key: string;
  to: string;
  label: string;
}

/** "g then <key>" navigation targets. */
export const GO_SHORTCUTS: GoShortcut[] = [
  { key: "d", to: "/", label: "Cockpit" },
  { key: "m", to: "/map", label: "Map" },
  { key: "c", to: "/calendar", label: "Calendar" },
  { key: "b", to: "/board", label: "Board" },
  { key: "v", to: "/values", label: "Values & Goals" },
  { key: "h", to: "/habits", label: "Habits" },
  { key: "a", to: "/analytics", label: "Analytics" },
  { key: "l", to: "/library", label: "Library" },
  { key: "r", to: "/review", label: "Review" },
  { key: "s", to: "/settings", label: "Settings" },
  { key: "x", to: "/lab", label: "Lab" },
];

export const GLOBAL_SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "⌘K", label: "Command bar" },
  { keys: "N", label: "New task / command bar" },
  { keys: "T", label: "Jump to Cockpit (today)" },
  { keys: "?", label: "Toggle this help" },
  { keys: "Esc", label: "Close overlays" },
];
