import { Link } from "react-router";
import { getValueColor } from "../color";
import type { Value } from "../model";

export function ValueWhy({ value, onNavigate }: { value: Value; onNavigate?: () => void }) {
  const hasWhy = value.desc.trim() !== "";
  return (
    <div className="flex gap-3">
      <span
        aria-hidden
        className="w-[3px] shrink-0 rounded-full"
        style={{ background: getValueColor(value) }}
      />
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-xs text-muted">In service of {value.name}</span>
        {hasWhy ? (
          <p className="whitespace-pre-wrap break-words text-sm text-foreground">{value.desc}</p>
        ) : (
          <Link
            to={`/values/${value.id}`}
            onClick={onNavigate}
            className="text-sm text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent"
          >
            Add why {value.name} matters
          </Link>
        )}
      </div>
    </div>
  );
}
