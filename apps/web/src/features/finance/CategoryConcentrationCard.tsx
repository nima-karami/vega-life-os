import type { FinanceMerchant } from "@vega/shared";
import { cx } from "@/core/ui";
import { describeConcentrationTail } from "./category-copy";
import type { MerchantConcentrationFigures } from "./category-detail-figures";
import { formatCents } from "./money";

/** The tail is a desaturated stand-in, deliberately not the category colour — it is not one thing. */
const TAIL_COLOR = "#C9BBA6";

interface ConcentrationEntry {
  key: string;
  label: string;
  cents: number;
  isTail: boolean;
}

export interface CategoryConcentrationCardProps {
  figures: MerchantConcentrationFigures;
  merchants: FinanceMerchant[];
  color: string;
}

function MiniBar({ fraction, color }: { fraction: number; color: string }) {
  return (
    <span aria-hidden className="relative block h-[5px] w-[52px] rounded-[3px] bg-paper-3">
      <span
        className="absolute inset-y-0 left-0 rounded-[3px]"
        style={{ width: `${Math.max(fraction, 0.02) * 100}%`, background: color }}
      />
    </span>
  );
}

/** Where the month's spend concentrates, leader first, with the rest collapsed into one honest row. */
export function CategoryConcentrationCard({
  figures,
  merchants,
  color,
}: CategoryConcentrationCardProps) {
  const namesById = new Map(merchants.map((merchant) => [merchant.id, merchant.displayName]));
  const entries: ConcentrationEntry[] = figures.entries.map((entry) => ({
    key: entry.key,
    label: namesById.get(entry.key) || entry.key,
    cents: entry.cents,
    isTail: false,
  }));
  if (figures.othersCount > 0)
    entries.push({
      key: "∅others",
      label: describeConcentrationTail(figures.othersCount),
      cents: figures.othersCents,
      isTail: true,
    });

  const leader = figures.entries[0]?.cents ?? 0;

  return (
    <section className="flex-1 rounded-[16px] border border-border bg-surface px-[18px] py-4 shadow-soft">
      <h2 className="mb-2.5 font-semibold text-[14px] text-foreground">Where it goes</h2>
      {entries.length === 0 ? (
        <p className="text-[13px] text-muted">Nothing landed in this category this month.</p>
      ) : (
        <ul className="flex flex-col gap-[9px]">
          {entries.map((entry) => (
            <li key={entry.key} className="flex items-center gap-2.5">
              <span
                className={cx(
                  "min-w-0 flex-1 truncate text-[13px]",
                  entry.isTail ? "text-muted" : "text-foreground",
                )}
              >
                {entry.label}
              </span>
              <MiniBar
                fraction={leader > 0 ? entry.cents / leader : 0}
                color={entry.isTail ? TAIL_COLOR : color}
              />
              <span
                className={cx(
                  "w-[52px] text-right text-[12.5px] tabular-nums",
                  entry.isTail ? "text-muted" : "font-medium text-foreground",
                )}
              >
                {formatCents(entry.cents)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
