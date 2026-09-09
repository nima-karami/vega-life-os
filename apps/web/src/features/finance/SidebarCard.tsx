import type { ReactNode } from "react";

export interface SidebarCardProps {
  heading: string;
  /** the "New account" button, or nothing */
  action?: ReactNode;
  /** the run-on note under a divider, as "Recent imports" carries today */
  footer?: ReactNode;
  /** scopes the card in e2e; only the accounts card sets one */
  testId?: string;
  children: ReactNode;
}

/** The one import-sidebar card shell: chrome, heading row, optional action, optional footer note. */
export function SidebarCard({ heading, action, footer, testId, children }: SidebarCardProps) {
  return (
    <section
      data-testid={testId}
      className="overflow-hidden rounded-[16px] border border-border bg-surface shadow-sm"
    >
      <div className="flex items-center justify-between gap-2 px-4 pt-3.5 pb-2">
        <h2 className="font-semibold text-[14px] text-foreground">{heading}</h2>
        {action}
      </div>
      {children}
      {footer && (
        <p className="border-t border-border px-4 pt-2.5 pb-3.5 text-[12px] text-muted">{footer}</p>
      )}
    </section>
  );
}
