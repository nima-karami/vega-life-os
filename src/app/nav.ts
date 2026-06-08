import type { IconName } from "@/core/lib/icon-names";

export interface NavItem {
  to: string;
  label: string;
  sub: string;
  icon: IconName;
  idx: string;
  end?: boolean;
}

export const NAV: NavItem[] = [
  { to: "/", label: "Cockpit", sub: "Today", icon: "orbit", idx: "00", end: true },
  { to: "/map", label: "Map", sub: "Orbit view", icon: "map", idx: "01" },
  { to: "/calendar", label: "Calendar", sub: "Week · schedule", icon: "calendar", idx: "02" },
  { to: "/board", label: "Board", sub: "Status · backlog", icon: "board", idx: "03" },
  { to: "/values", label: "Values & Goals", sub: "The why", icon: "tree", idx: "04" },
  { to: "/habits", label: "Habits", sub: "Recurrence", icon: "repeat", idx: "05" },
  { to: "/analytics", label: "Analytics", sub: "Follow-through", icon: "chart", idx: "06" },
  { to: "/library", label: "Library", sub: "Books · film · words", icon: "book", idx: "07" },
  { to: "/review", label: "Review", sub: "The mirror", icon: "note", idx: "08" },
];
