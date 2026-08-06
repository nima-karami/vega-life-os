import type { ReactNode } from "react";
import { Icon } from "@/core/ui";

const TONES = {
  info: { border: "border-border", text: "text-foreground", icon: "check" },
  warning: { border: "border-border", text: "text-warning", icon: "alert" },
  danger: { border: "border-border", text: "text-danger", icon: "alert" },
} as const;

export interface FinanceNoticeProps {
  tone: keyof typeof TONES;
  title: string;
  body?: string;
  actions?: ReactNode;
}

/** Every offline, failure and terminal state on the money screens reads the same way, and announces itself. */
export function FinanceNotice({ tone, title, body, actions }: FinanceNoticeProps) {
  const style = TONES[tone];
  return (
    <section
      role="status"
      className={`mt-6 rounded-[16px] border bg-surface px-4 py-4 ${style.border}`}
    >
      <p className={`flex items-center gap-2 text-sm font-medium ${style.text}`}>
        <Icon name={style.icon} size={16} />
        {title}
      </p>
      {body && <p className="mt-1.5 text-sm text-muted">{body}</p>}
      {actions && <div className="mt-3 flex flex-wrap gap-2">{actions}</div>}
    </section>
  );
}
