import { useValueColor } from "@/features/values/useValueColor";

export function ValueBalanceBar({
  valueId,
  name,
  count,
  max,
}: {
  valueId: string;
  name: string;
  count: number;
  max: number;
}) {
  const color = useValueColor(valueId);
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 truncate text-xs text-muted">{name}</span>
      <div className="h-3 flex-1 rounded-full bg-surface-secondary">
        <div
          className="h-3 rounded-full"
          style={{ width: `${(count / max) * 100}%`, background: color }}
        />
      </div>
      <span className="w-6 text-right text-xs tabular-nums text-muted">{count}</span>
    </div>
  );
}
