import { NavLink } from "react-router-dom";
import { cx, Icon } from "@/core/ui";
import { NAV } from "./nav";

export function NavRow() {
  return (
    <nav className="no-scrollbar flex gap-2 overflow-x-auto border-b border-[var(--color-line)] px-4 py-2.5">
      {NAV.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.end}
          className={({ isActive }) =>
            cx(
              "group relative flex min-w-[128px] flex-1 items-start gap-2.5 border px-3 py-2 transition-colors",
              isActive
                ? "border-ink bg-ink text-paper"
                : "border-[var(--color-line)] text-ink hover:border-ink/40",
            )
          }
        >
          <Icon name={item.icon} size={17} className="mt-0.5 shrink-0" />
          <span className="flex flex-col leading-tight">
            <span className="display text-[13px] tracking-tight">{item.label}</span>
            <span
              className="mono mt-0.5 text-[9px] uppercase tracking-[0.12em] opacity-60"
            >
              {item.sub}
            </span>
          </span>
          <span className="mono absolute right-2 top-1.5 text-[9px] opacity-40">
            {item.idx}
          </span>
        </NavLink>
      ))}
    </nav>
  );
}
