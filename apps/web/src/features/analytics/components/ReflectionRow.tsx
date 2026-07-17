import { Icon } from "@/core/ui";
import { CHART_PRIMARY } from "../chart-constants";
import type { ReflectionStat } from "../selectors";

export function ReflectionRow({
  label,
  icon,
  stat,
}: {
  label: string;
  icon: "note" | "heart";
  stat: ReflectionStat;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm text-foreground">
          <Icon name={icon} size={14} className="text-muted" />
          {label}
        </span>
        <span className="text-xs tabular-nums text-muted">
          {stat.count} of {stat.series.length} days · {stat.streak}-day streak
        </span>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-[3px]">
        {stat.series.map((d) => (
          <span
            key={d.iso}
            title={`${d.iso}${d.on ? " · logged" : ""}`}
            className={d.on ? "" : "border border-border"}
            style={{
              width: 11,
              height: 11,
              borderRadius: 2,
              background: d.on ? CHART_PRIMARY : "transparent",
            }}
          />
        ))}
      </div>
    </div>
  );
}
