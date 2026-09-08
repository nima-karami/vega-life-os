import type { ReactNode } from "react";
import { cx } from "@/core/ui";

export interface CompactMetaItem {
  /** Omitted where the desktop cell carries no header word of its own. */
  label?: string;
  value: ReactNode;
}

export interface CompactRowProps {
  swatch?: string | null;
  title: ReactNode;
  amount: ReactNode;
  /** The row's money weight and colour, chosen by the twin — one string, never two cx args. */
  amountClassName?: string;
  amountNote?: ReactNode;
  meta: CompactMetaItem[];
  footer?: ReactNode;
  actions?: ReactNode;
  isLast: boolean;
  className?: string;
}

const AMOUNT_CLASS = "font-medium text-[14px] text-foreground tabular-nums";

/**
 * The one row shape every compact finance grid maps onto: what the row is on the first line, the
 * columns it dropped as label·value pairs on the second, and the figure held down the right.
 */
export function CompactRow({
  swatch,
  title,
  amount,
  amountClassName,
  amountNote,
  meta,
  footer,
  actions,
  isLast,
  className,
}: CompactRowProps) {
  return (
    <div className={cx("px-3.5 py-2.5", !isLast && "border-border border-b", className)}>
      <div className="flex min-h-[60px] items-center gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex min-w-0 items-center gap-[9px]">
            {swatch != null && (
              <span
                aria-hidden
                className="size-2.5 shrink-0 rounded-[3px]"
                style={{ background: swatch }}
              />
            )}
            <span className="min-w-0 truncate font-medium text-[14px] text-foreground">
              {title}
            </span>
          </div>

          {meta.length > 0 && (
            <div className="mt-1 flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted">
              {meta.map((item, index) => (
                <span
                  key={item.label ?? `slot-${index}`}
                  className="flex min-w-0 flex-wrap items-center gap-[5px]"
                >
                  {item.label !== undefined && <span>{item.label}</span>}
                  {item.value}
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="shrink-0 text-right">
          <p className={amountClassName ?? AMOUNT_CLASS}>{amount}</p>
          {amountNote !== undefined && (
            <p className="text-[11.5px] text-muted tabular-nums">{amountNote}</p>
          )}
        </div>

        {actions !== undefined && (
          <div className="flex shrink-0 items-center gap-0.5 text-muted">{actions}</div>
        )}
      </div>

      {footer !== undefined && <div className="mt-2">{footer}</div>}
    </div>
  );
}
