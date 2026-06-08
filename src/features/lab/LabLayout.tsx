import { Suspense } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import { cx, Icon } from "@/core/ui";

export const LAB_VARIANTS = [
  { to: "/lab", label: "Index", end: true, blurb: "" },
  { to: "/lab/galaxy", label: "Galaxy", blurb: "Your value system as a 3D galaxy — stars, planets, orbits." },
  { to: "/lab/globe", label: "Globe", blurb: "A slow-turning monochrome globe, values as illuminated markers." },
  { to: "/lab/constellation", label: "Constellation", blurb: "A 2D star-chart of the whole life web." },
  { to: "/lab/terminal", label: "Terminal", blurb: "Life OS as a command line. Everything is text." },
  { to: "/lab/blueprint", label: "Blueprint", blurb: "A drafting-table technical schematic of today." },
];

export function LabLayout() {
  return (
    <div className="flex h-screen flex-col bg-void text-[#efeada]" data-theme="void">
      <header className="flex items-center gap-4 border-b border-[var(--color-line)] px-4 py-2">
        <Link to="/" className="mono flex items-center gap-1.5 text-[11px] tracking-[0.1em] text-[#8a877a] hover:text-[#efeada]">
          <Icon name="chevL" size={13} /> EXIT LAB
        </Link>
        <span className="display text-[13px] tracking-tight">VEGA · LAB</span>
        <span className="mono text-[10px] tracking-[0.16em] text-[#8a877a]">// DESIGN VARIANTS</span>
        <nav className="no-scrollbar ml-auto flex gap-1 overflow-x-auto">
          {LAB_VARIANTS.map((v) => (
            <NavLink key={v.to} to={v.to} end={v.end}
              className={({ isActive }) => cx(
                "mono whitespace-nowrap border px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] transition-colors",
                isActive ? "border-[#efeada] bg-[#efeada] text-void" : "border-[var(--color-line)] text-[#8a877a] hover:text-[#efeada]",
              )}>
              {v.label}
            </NavLink>
          ))}
        </nav>
      </header>
      <main className="relative min-h-0 flex-1 overflow-hidden">
        <Suspense fallback={<div className="grid h-full place-items-center"><span className="mono animate-pulse text-[11px] tracking-[0.16em] text-[#8a877a]">// rendering variant…</span></div>}>
          <Outlet />
        </Suspense>
      </main>
    </div>
  );
}
