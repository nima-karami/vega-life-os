import type { ReactNode } from "react";
import { cx } from "@/core/ui";

export interface CompactMetaItem {
  /** Omitted where the desktop cell carries no header word of its own. */
  label?: string;
  value: ReactNode;
  /** A control rather than text: it gets its own line under the figures, clear of the amount cell. */
  isControl?: boolean;
  /** Unbounded text a person typed, so it ellipsises rather than running past the row. */
  isFreeText?: boolean;
  /** Follows the value and never ellipsises — the words a long free-text value must not eat. */
  suffix?: string;
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
const META_RUN_CLASS = "flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1 text-[12px] text-muted";

function MetaPair({ item, isOwnLine }: { item: CompactMetaItem; isOwnLine: boolean }) {
  const isEllipsised = item.isFreeText === true && !isOwnLine;
  const valueClass = isEllipsised ? "min-w-0 truncate" : undefined;

  return (
    <span
      className={cx(
        "flex items-center gap-[5px]",
        !isOwnLine && "whitespace-nowrap",
        isEllipsised && "min-w-0",
      )}
    >
      {item.label !== undefined && (
        <span className="shrink-0 font-medium text-foreground/70">{item.label}</span>
      )}
      {item.suffix === undefined ? (
        <span className={valueClass}>{item.value}</span>
      ) : (
        <span className={cx("flex items-baseline", isEllipsised && "min-w-0")}>
          <span className={valueClass}>{item.value}</span>
          <span className="shrink-0 whitespace-pre">{item.suffix}</span>
        </span>
      )}
    </span>
  );
}

/** The one row shape every compact finance grid maps onto. */
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
  const inlineMeta = meta.filter((item) => item.isControl !== true);
  const controlMeta = meta.filter((item) => item.isControl === true);

  return (
    <div className={cx("px-3.5 py-2.5", !isLast && "border-border border-b", className)}>
      <div className="flex min-h-[60px] flex-col justify-center gap-1">
        <div className="flex min-w-0 items-center gap-[9px]">
          {swatch != null && (
            <span
              aria-hidden
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ background: swatch }}
            />
          )}
          <span className="min-w-0 truncate font-medium text-[14px] text-foreground">{title}</span>
        </div>

        <div className="flex items-center gap-3">
          <div className={cx("flex-1", META_RUN_CLASS)}>
            {inlineMeta.map((item, index) => (
              <MetaPair key={item.label ?? `slot-${index}`} item={item} isOwnLine={false} />
            ))}
          </div>

          <div className="shrink-0 text-right">
            <p data-testid="compact-amount" className={amountClassName ?? AMOUNT_CLASS}>
              {amount}
            </p>
            {amountNote !== undefined && (
              <p className="text-[11.5px] text-muted tabular-nums">{amountNote}</p>
            )}
          </div>

          {actions !== undefined && (
            <div className="flex shrink-0 items-center gap-0.5 text-muted">{actions}</div>
          )}
        </div>
      </div>

      {controlMeta.length > 0 && (
        <div className={cx("mt-2", META_RUN_CLASS)}>
          {controlMeta.map((item, index) => (
            <MetaPair key={item.label ?? `control-${index}`} item={item} isOwnLine />
          ))}
        </div>
      )}

      {footer !== undefined && <div className="mt-2">{footer}</div>}
    </div>
  );
}
