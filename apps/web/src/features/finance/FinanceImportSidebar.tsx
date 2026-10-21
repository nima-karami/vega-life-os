import type { FinanceAccount } from "@vega/shared";
import type { IconName } from "@/core/lib/icon-names";
import { Icon, type MenuItem } from "@/core/ui";
import { FinanceAccountsCard } from "./FinanceAccountsCard";
import type { RecentImport } from "./import-preview";
import { SidebarCard } from "./SidebarCard";

const RULES: { icon: IconName; tone: string; body: string }[] = [
  {
    icon: "shield-check",
    tone: "text-success",
    body: "Duplicates matched on date + amount + description, so re-importing the same week is safe.",
  },
  {
    icon: "minus-circle",
    tone: "text-muted",
    body: "Card payments and transfers land as internal: they move money, they don’t spend it, so no figure counts them.",
  },
];

const FOOTER = "Every imported row keeps its file and line, so an import can be undone whole.";

export interface FinanceImportSidebarProps {
  /** how many rows a commit would write, or null when nothing is staged */
  newRows: number | null;
  recent: RecentImport[];
  accounts: FinanceAccount[];
  buildMenuItems: (account: FinanceAccount) => MenuItem[];
  onCreateAccount: () => void;
}

const NOTHING_LANDS = "Nothing new lands. Every row in this file is already in Transactions.";

function AfterImportBody({ newRows }: { newRows: number | null }) {
  if (newRows === 0) return <>{NOTHING_LANDS}</>;
  return (
    <>
      {newRows === null ? "The rows" : `The ${newRows} rows`} land in Transactions marked{" "}
      <em>needs review</em>, with categories guessed and splits left empty. The badge on the sub-nav
      carries the count, so the weekly pass is: import, then clear the badge.
    </>
  );
}

function AfterImportCard({ newRows }: { newRows: number | null }) {
  return (
    <SidebarCard heading="After import">
      <div className="px-4 pb-4">
        <p className="text-[13px] text-muted leading-[1.55]">
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
      </div>
    </SidebarCard>
  );
}

function RecentImportsCard({ recent }: { recent: RecentImport[] }) {
  return (
    <SidebarCard heading="Recent imports" footer={FOOTER}>
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
    </SidebarCard>
  );
}

/** The accounts a statement can land in, what the import will leave behind, and what earlier ones did. */
export function FinanceImportSidebar({
  newRows,
  recent,
  accounts,
  buildMenuItems,
  onCreateAccount,
}: FinanceImportSidebarProps) {
  return (
    <div className="flex flex-col gap-3">
      <FinanceAccountsCard
        accounts={accounts}
        buildMenuItems={buildMenuItems}
        onCreate={onCreateAccount}
      />
      <AfterImportCard newRows={newRows} />
      {recent.length > 0 && <RecentImportsCard recent={recent} />}
    </div>
  );
}
