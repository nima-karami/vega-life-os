import type { IconName } from "@/core/lib/icon-names";
import { Icon } from "@/core/ui";
import type { RecentImport } from "./import-preview";

const RULES: { icon: IconName; tone: string; body: string }[] = [
  {
    icon: "shield-check",
    tone: "text-success",
    body: "Duplicates matched on date + amount + description, so re-importing the same week is safe.",
  },
  {
    icon: "minus-circle",
    tone: "text-muted",
    body: "Card payments and transfers land as internal — they move money, they don’t spend it, so no figure counts them.",
  },
];

const FOOTER = "Every imported row keeps its file and line, so an import can be undone whole.";

export interface FinanceImportSidebarProps {
  /** how many rows a commit would write, or null when nothing is staged */
  newRows: number | null;
  recent: RecentImport[];
}

const NOTHING_LANDS = "Nothing new lands — every row in this file is already in Transactions.";

function AfterImportBody({ newRows }: { newRows: number | null }) {
  if (newRows === 0) return <>{NOTHING_LANDS}</>;
  return (
    <>
      {newRows === null ? "The rows" : `The ${newRows} rows`} land in Transactions marked{" "}
      <em>needs review</em> — categories guessed, splits left empty. The badge on the sub-nav
      carries the count, so the weekly pass is: import, then clear the badge.
    </>
  );
}

function AfterImportCard({ newRows }: { newRows: number | null }) {
  return (
    <section className="rounded-[16px] border border-border bg-surface px-[18px] py-4 shadow-sm">
      <h2 className="font-semibold text-[14px] text-foreground">After import</h2>
      <p className="mt-1.5 text-[13px] text-muted leading-[1.55]">
        <AfterImportBody newRows={newRows} />
      </p>
      <div className="mt-3 flex flex-col gap-[7px] text-[12.5px] text-muted">
        {RULES.map((rule) => (
          <p key={rule.icon} className="flex gap-2">
            <Icon
              name={rule.icon}
              size={15}
              className={`mt-px shrink-0 ${rule.tone}`}
              aria-hidden
            />
            <span>{rule.body}</span>
          </p>
        ))}
      </div>
    </section>
  );
}

function RecentImportsCard({ recent }: { recent: RecentImport[] }) {
  return (
    <section className="overflow-hidden rounded-[16px] border border-border bg-surface shadow-sm">
      <h2 className="px-4 pt-3.5 pb-2 font-semibold text-[14px] text-foreground">Recent imports</h2>
      <div className="flex flex-col px-4 pb-1.5">
        {recent.map((entry, index) => (
          <div
            key={entry.id}
            className={`flex h-[38px] items-center justify-between gap-3 ${
              index === recent.length - 1 ? "" : "border-b border-line-soft"
            }`}
          >
            <span className="truncate font-mono text-[11.5px] text-foreground">
              {entry.fileName}
            </span>
            <span className="shrink-0 text-[12px] text-muted tabular-nums">
              {entry.when} · {entry.added} added
            </span>
          </div>
        ))}
      </div>
      <p className="border-t border-border px-4 pt-2.5 pb-3.5 text-[12px] text-muted">{FOOTER}</p>
    </section>
  );
}

/** What the import will leave behind, and what earlier ones already did. */
export function FinanceImportSidebar({ newRows, recent }: FinanceImportSidebarProps) {
  return (
    <div className="flex flex-col gap-3">
      <AfterImportCard newRows={newRows} />
      {recent.length > 0 && <RecentImportsCard recent={recent} />}
    </div>
  );
}
