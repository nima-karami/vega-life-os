import type { ReactNode } from "react";

export function EmptyState({ title, body, cta }: { title: string; body: string; cta: ReactNode }) {
  return (
    <div className="mt-10 flex flex-col items-center gap-3 rounded-[16px] border border-dashed border-border py-16 text-center">
      <p className="text-base font-medium text-foreground">{title}</p>
      <p className="max-w-sm text-sm text-muted">{body}</p>
      <div className="mt-2">{cta}</div>
    </div>
  );
}
