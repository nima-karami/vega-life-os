import type { FinanceAccount, FinanceAccountKind } from "@vega/shared";

const KIND_LABELS: Record<FinanceAccountKind, string> = {
  chequing: "Chequing",
  savings: "Savings",
  credit_card: "Credit card",
};

export function describeAccountKind(kind: FinanceAccountKind): string {
  return KIND_LABELS[kind];
}

export function describeAccountMeta(account: FinanceAccount): string {
  const kind = describeAccountKind(account.kind);
  return account.isBusiness ? `${kind} · Business` : kind;
}

export function describeAccountArchive(rowCount: number): string {
  const tail = "it just stops being offered as an import target.";
  if (rowCount === 0) return `Nothing is filed against it yet — ${tail}`;
  const rows =
    rowCount === 1
      ? "Its 1 transaction stays exactly where it is"
      : `Its ${rowCount} transactions stay exactly where they are`;
  return `${rows} — ${tail}`;
}
