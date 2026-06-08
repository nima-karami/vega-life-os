import { Link } from "react-router-dom";
import { cx } from "@/core/ui";
import { LAB_VARIANTS } from "./LabLayout";

export function LabIndex() {
  const variants = LAB_VARIANTS.filter((v) => v.to !== "/lab");
  return (
    <div className="h-full overflow-y-auto px-6 py-10">
      <div className="mx-auto max-w-4xl">
        <p className="mono text-[11px] tracking-[0.16em] text-[#8a877a]">// THE LAB</p>
        <h1 className="display mt-2 text-5xl leading-none">Same data. Six worlds.</h1>
        <p className="mono mt-3 max-w-xl text-[12px] leading-relaxed text-[#b6b1a2]">
          Each variant is a complete, live take on the very same Values → Goals → Habits → Tasks
          model — not mockups. Pick a direction; we roll it across the whole app.
        </p>

        <div className="mt-8 grid grid-cols-1 gap-3 sm:grid-cols-2">
          {variants.map((v, i) => (
            <Link key={v.to} to={v.to}
              className={cx(
                "group flex flex-col justify-between border border-[var(--color-line)] p-5 transition-colors hover:border-[#efeada]",
                "min-h-[150px]",
              )}>
              <span className="mono text-[10px] tracking-[0.16em] text-[#8a877a]">0{i + 1}</span>
              <div>
                <h2 className="display text-2xl group-hover:translate-x-0.5 transition-transform">{v.label}</h2>
                <p className="mono mt-1.5 text-[11px] leading-relaxed text-[#b6b1a2]">{v.blurb}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}
