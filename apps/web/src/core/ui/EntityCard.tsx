import type { ReactNode } from "react";
import { Link } from "react-router";
import type { IconName } from "@/core/lib/icon-names";
import { cx } from "./cx";
import { Icon } from "./icons";

/** The measure block — the only part of the card that varies by entity. Fixed height
 *  so a mixed list of goals, habits and values keeps one rhythm. */
export type CardMeasure =
  | { kind: "progress"; fraction: number }
  | { kind: "week"; days: CardWeekDay[] }
  | { kind: "none" };

const WEEK_BAR_CLASS: Record<CardWeekDay["state"], string> = {
  kept: "bg-white",
  due: "bg-white/[.22]",
  off: "bg-transparent",
};

export interface CardWeekDay {
  /** ISO date — the key, since weekday letters repeat (T, S). */
  iso: string;
  letter: string;
  state: "kept" | "due" | "off";
}

export interface CardMeta {
  text: string;
  /** The one figure still in play — rendered at full white against the .86 rest. */
  live?: boolean;
}

export type CardTone = "full" | "paused" | "archived";

const TONE_OPACITY: Record<CardTone, string> = {
  full: "",
  paused: "opacity-80",
  archived: "opacity-60",
};

/**
 * One card for a value, a goal or a habit. The value's colour floods the whole card
 * and everything on it is white or white-alpha — which entity it represents changes
 * its fields, never its shape.
 */
export function EntityCard({
  fill,
  icon,
  title,
  to,
  status,
  measure,
  meta,
  tone = "full",
  struck,
  actions,
}: {
  fill: string;
  icon: IconName;
  title: string;
  to?: string;
  status?: { label: string; icon: IconName };
  measure: CardMeasure;
  meta: CardMeta[];
  tone?: CardTone;
  struck?: boolean;
  actions?: ReactNode;
}) {
  return (
    <div
      className={cx("relative rounded-[16px] border p-4", TONE_OPACITY[tone])}
      style={{ background: fill, borderColor: fill }}
    >
      <div className="flex items-center gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[.18] text-white">
          <Icon name={icon} size={17} />
        </span>
        {to ? (
          <Link
            to={to}
            className={cx(
              "min-w-0 flex-1 truncate text-[15px] font-medium text-white outline-none",
              "after:absolute after:inset-0 after:rounded-[16px] focus-visible:after:ring-2 focus-visible:after:ring-white",
              struck && "line-through",
            )}
          >
            {title}
          </Link>
        ) : (
          <span
            className={cx(
              "min-w-0 flex-1 truncate text-[15px] font-medium text-white",
              struck && "line-through",
            )}
          >
            {title}
          </span>
        )}
        {status && (
          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/20 px-[9px] py-[3px] text-[12px] text-white">
            <Icon name={status.icon} size={11} />
            {status.label}
          </span>
        )}
        {actions && <span className="relative z-10 shrink-0 text-white">{actions}</span>}
      </div>

      <div className="mt-3 h-[26px]">
        <CardMeasureBlock measure={measure} />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[12px] text-white/[.86]">
        {meta.map((m, i) => (
          <span key={m.text} className="contents">
            {i > 0 && <span aria-hidden>·</span>}
            <span className={cx(m.live && "text-white")}>{m.text}</span>
          </span>
        ))}
      </div>
    </div>
  );
}

function CardMeasureBlock({ measure }: { measure: CardMeasure }) {
  if (measure.kind === "progress")
    return (
      <div className="h-[5px] overflow-hidden rounded-full bg-white/[.22]">
        <span
          className="block h-full rounded-full bg-white"
          style={{ width: `${Math.round(Math.min(1, Math.max(0, measure.fraction)) * 100)}%` }}
        />
      </div>
    );

  if (measure.kind === "week")
    return (
      <div className="flex gap-2">
        {measure.days.map((d) => (
          <span key={d.iso} className="flex flex-1 flex-col items-center gap-[5px]">
            <span className={cx("h-[5px] w-full rounded-full", WEEK_BAR_CLASS[d.state])} />
            <span
              className={cx(
                "text-[9.5px] leading-none",
                d.state === "off" ? "text-white/[.5]" : "text-white/[.86]",
              )}
            >
              {d.letter}
            </span>
          </span>
        ))}
      </div>
    );

  return null;
}
