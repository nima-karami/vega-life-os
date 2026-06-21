export interface GoShortcut {
  key: string;
  to: string;
  label: string;
}

/** "g then <key>" navigation targets — 5 v1 routes only. */
export const GO_SHORTCUTS: GoShortcut[] = [
  { key: "t", to: "/today", label: "Today" },
  { key: "v", to: "/values", label: "Values & Goals" },
  { key: "h", to: "/habits", label: "Habits" },
  { key: "c", to: "/calendar", label: "Calendar" },
  { key: "a", to: "/analytics", label: "Analytics" },
  { key: "s", to: "/settings", label: "Settings" },
];

export const GLOBAL_SHORTCUTS: { keys: string; label: string }[] = [
  { keys: "⌘K", label: "Command bar" },
  { keys: "N", label: "New task / command bar" },
  { keys: "?", label: "Toggle this help" },
  { keys: "Esc", label: "Close overlays" },
  { keys: "g t", label: "Jump to Today" },
  { keys: "g v", label: "Jump to Values" },
  { keys: "g h", label: "Jump to Habits" },
  { keys: "g c", label: "Jump to Calendar" },
  { keys: "g a", label: "Jump to Analytics" },
];
