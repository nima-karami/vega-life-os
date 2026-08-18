import type { ReactNode } from "react";
import { cx, Icon } from "@/core/ui";
import type { SettlementNote } from "./settlement-copy";

/**
 * The column that sits beside the action, which is the whole point of it: whatever stands between
 * the owner and an agreed figure is read where the settle button is, not at the bottom of the page.
 */
export function SettlementPeriodNotes({
  title,
  notes,
  actions,
}: {
  title: string;
  notes: SettlementNote[];
  actions: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-2.5 border-border border-t pt-4 lg:border-t-0 lg:border-l lg:pt-0 lg:pl-[22px]">
      <h2 className="font-semibold text-[14px] text-foreground">{title}</h2>
      {notes.map((note) => (
        <p key={note.text} className="flex gap-[9px] text-[12.5px] text-muted leading-[1.5]">
          <Icon
            name={note.icon}
            size={15}
            aria-hidden
            className={cx("mt-px shrink-0", note.isBlocking ? "text-warning" : "text-muted")}
          />
          <span>{note.text}</span>
        </p>
      ))}
      {actions}
    </div>
  );
}
