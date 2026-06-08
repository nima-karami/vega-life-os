import type { SVGProps } from "react";
import type { IconName } from "@/core/lib/icon-names";

type P = SVGProps<SVGSVGElement>;
const base = {
  viewBox: "0 0 24 24",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
};

export const Ic: Record<IconName, (p: P) => JSX.Element> = {
  calendar: (p) => (<svg {...base} {...p}><rect x="3" y="4.5" width="18" height="16" rx="3" /><path d="M3 9h18M8 2.5v4M16 2.5v4" /></svg>),
  board: (p) => (<svg {...base} {...p}><rect x="3" y="4" width="5" height="16" rx="1.5" /><rect x="10" y="4" width="5" height="11" rx="1.5" /><rect x="17" y="4" width="4" height="14" rx="1.5" /></svg>),
  tree: (p) => (<svg {...base} {...p}><circle cx="12" cy="4.5" r="2.2" /><circle cx="5" cy="19" r="2.2" /><circle cx="12" cy="19" r="2.2" /><circle cx="19" cy="19" r="2.2" /><path d="M12 6.7v4.3M12 11h-7v5.8M12 11h7v5.8M12 11v5.8" /></svg>),
  repeat: (p) => (<svg {...base} {...p}><path d="M17 2l4 4-4 4" /><path d="M3 11V9a4 4 0 0 1 4-4h14M7 22l-4-4 4-4" /><path d="M21 13v2a4 4 0 0 1-4 4H3" /></svg>),
  chart: (p) => (<svg {...base} {...p}><path d="M4 4v16h16" /><path d="M7 14l3.5-4 3 2.5L20 7" /></svg>),
  check: (p) => (<svg {...base} strokeWidth={2.6} {...p}><path d="M5 12.5l4.5 4.5L19 7" /></svg>),
  skip: (p) => (<svg {...base} strokeWidth={2.2} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>),
  note: (p) => (<svg {...base} {...p}><path d="M4 5h16v10l-5 5H4z" /><path d="M14 20v-5h5" /></svg>),
  plus: (p) => (<svg {...base} strokeWidth={2} {...p}><path d="M12 5v14M5 12h14" /></svg>),
  spark: (p) => (<svg {...base} {...p}><path d="M13 2L4.5 13.5H11l-1 8.5L19.5 10H13z" /></svg>),
  bell: (p) => (<svg {...base} {...p}><path d="M6 9a6 6 0 0 1 12 0c0 5 2 6 2 6H4s2-1 2-6" /><path d="M10 20a2 2 0 0 0 4 0" /></svg>),
  search: (p) => (<svg {...base} {...p}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4-4" /></svg>),
  chevL: (p) => (<svg {...base} strokeWidth={2} {...p}><path d="M15 6l-6 6 6 6" /></svg>),
  chevR: (p) => (<svg {...base} strokeWidth={2} {...p}><path d="M9 6l6 6-6 6" /></svg>),
  chevD: (p) => (<svg {...base} strokeWidth={2} {...p}><path d="M6 9l6 6 6-6" /></svg>),
  chevU: (p) => (<svg {...base} strokeWidth={2} {...p}><path d="M6 15l6-6 6 6" /></svg>),
  close: (p) => (<svg {...base} strokeWidth={2} {...p}><path d="M6 6l12 12M18 6L6 18" /></svg>),
  link: (p) => (<svg {...base} {...p}><path d="M10 13a5 5 0 0 0 7 0l2-2a5 5 0 0 0-7-7l-1 1" /><path d="M14 11a5 5 0 0 0-7 0l-2 2a5 5 0 0 0 7 7l1-1" /></svg>),
  unlink: (p) => (<svg {...base} {...p}><path d="M8 12l-2 2a4.5 4.5 0 0 0 6 6l1-1M16 12l2-2a4.5 4.5 0 0 0-6-6l-1 1" /><path d="M3 3l18 18" /></svg>),
  alert: (p) => (<svg {...base} strokeWidth={1.9} {...p}><path d="M12 3l9 16H3z" /><path d="M12 10v4M12 17h.01" /></svg>),
  book: (p) => (<svg {...base} {...p}><path d="M4 5a2 2 0 0 1 2-2h6v18H6a2 2 0 0 0-2 2zM20 5a2 2 0 0 0-2-2h-6v18h6a2 2 0 0 1 2 2z" /></svg>),
  card: (p) => (<svg {...base} {...p}><rect x="3" y="5" width="18" height="14" rx="2.5" /><path d="M3 10h18M7 15h4" /></svg>),
  briefcase: (p) => (<svg {...base} {...p}><rect x="3" y="7" width="18" height="13" rx="2.5" /><path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M3 12h18" /></svg>),
  heart: (p) => (<svg {...base} {...p}><path d="M12 20s-7-4.5-9.5-9C1 8 2.5 4.5 6 4.5c2 0 3.2 1.2 4 2.3.8-1.1 2-2.3 4-2.3 3.5 0 5 3.5 3.5 6.5C19 15.5 12 20 12 20z" /></svg>),
  shield: (p) => (<svg {...base} {...p}><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /></svg>),
  eye: (p) => (<svg {...base} {...p}><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="2.8" /></svg>),
  target: (p) => (<svg {...base} {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="4" /><circle cx="12" cy="12" r="1" fill="currentColor" /></svg>),
  sliders: (p) => (<svg {...base} {...p}><path d="M4 8h10M18 8h2M4 16h2M10 16h10" /><circle cx="16" cy="8" r="2.4" /><circle cx="8" cy="16" r="2.4" /></svg>),
  flash: (p) => (<svg {...base} strokeWidth={1.9} {...p}><path d="M13 2L4 14h7l-1 8 9-12h-7z" /></svg>),
  dots: (p) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><circle cx="5" cy="12" r="1.8" /><circle cx="12" cy="12" r="1.8" /><circle cx="19" cy="12" r="1.8" /></svg>),
  drag: (p) => (<svg viewBox="0 0 24 24" fill="currentColor" {...p}><circle cx="9" cy="6" r="1.5" /><circle cx="15" cy="6" r="1.5" /><circle cx="9" cy="12" r="1.5" /><circle cx="15" cy="12" r="1.5" /><circle cx="9" cy="18" r="1.5" /><circle cx="15" cy="18" r="1.5" /></svg>),
  clock: (p) => (<svg {...base} {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></svg>),
  orbit: (p) => (<svg {...base} {...p}><circle cx="12" cy="12" r="3.2" fill="currentColor" stroke="none" /><ellipse cx="12" cy="12" rx="10" ry="4.4" /><ellipse cx="12" cy="12" rx="10" ry="4.4" transform="rotate(60 12 12)" /></svg>),
  compass: (p) => (<svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M15.5 8.5l-2 5-5 2 2-5z" /></svg>),
  film: (p) => (<svg {...base} {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4" /></svg>),
  languages: (p) => (<svg {...base} {...p}><path d="M4 5h7M8 3v2c0 4-2 7-5 8M5 9c0 3 3 5 6 6M13 21l4-9 4 9M14.5 17h5" /></svg>),
  sun: (p) => (<svg {...base} {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5L19 19M19 5l-1.5 1.5M6.5 17.5L5 19" /></svg>),
  moon: (p) => (<svg {...base} {...p}><path d="M21 12.8A8 8 0 1 1 11.2 3a6.5 6.5 0 0 0 9.8 9.8z" /></svg>),
  map: (p) => (<svg {...base} {...p}><circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" /><ellipse cx="12" cy="12" rx="9" ry="3.6" /><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)" /></svg>),
  terminal: (p) => (<svg {...base} {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M7 9l3 3-3 3M13 15h4" /></svg>),
  globe: (p) => (<svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" /></svg>),
  command: (p) => (<svg {...base} {...p}><path d="M9 6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3z" /></svg>),
  trash: (p) => (<svg {...base} {...p}><path d="M4 7h16M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M6 7l1 13a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-13" /></svg>),
  edit: (p) => (<svg {...base} {...p}><path d="M4 20h4L20 8l-4-4L4 16z" /><path d="M14 6l4 4" /></svg>),
};

export function Icon({
  name,
  size = 18,
  className,
  ...rest
}: { name: IconName; size?: number; className?: string } & P) {
  const C = Ic[name] ?? Ic.compass;
  return <C width={size} height={size} className={className} {...rest} />;
}
