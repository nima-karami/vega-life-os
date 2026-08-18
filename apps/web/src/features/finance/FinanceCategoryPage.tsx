import { Button as HeroButton } from "@heroui/react";
import { format, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useStore } from "@/core/store";
import { cx, Icon } from "@/core/ui";
import { CategoryConcentrationCard } from "./CategoryConcentrationCard";
import { CategoryEditorModal } from "./CategoryEditorModal";
import { CategoryMonthCard } from "./CategoryMonthCard";
import { type CategoryChartRange, CategoryMonthsChart } from "./CategoryMonthsChart";
import { CategoryRowsCard } from "./CategoryRowsCard";
import { describeCategoryHeadline } from "./category-copy";
import {
  computeCategoryCaptionFigures,
  computeCategoryMonthlySeries,
  computeCategoryMonthRowFigures,
  computeMerchantConcentration,
  listCategoryMonths,
  selectCategoryMonthRows,
} from "./category-detail-figures";
import { getCategoryColor } from "./category-palette";
import { computeCategoryBreachDays } from "./dashboard-charts";
import { FinanceNotice } from "./FinanceNotice";
import { FinancePageShell } from "./FinancePageShell";
import { buildLedgerLookups, buildLedgerRowView } from "./ledger-row";
import { toMonthKey } from "./month-cursor";
import { computeMonthElapsedFraction } from "./primitives";
import { computeBorneSpendByCategory, resolveEffectiveBudgets } from "./queries";
import { listSettledMonths } from "./transactions-query";
import { useFinanceBook } from "./useFinanceBook";

const BACK_LINK = { to: "/finance/categories", label: "Categories" };
const SECONDARY =
  "h-9 rounded-[12px] border border-border bg-surface px-3.5 font-semibold text-[13px] text-foreground transition-colors hover:border-muted";
const TOP_MERCHANTS = 4;
/** The list is a read of the month, not the ledger — the strip states what it does not show. */
const VISIBLE_ROWS = 8;

const RANGE_MONTHS: Record<CategoryChartRange, number | null> = { "12": 12, "6": 6, all: null };

function CategoryNotFound() {
  return (
    <FinancePageShell
      title="Category"
      subLine="This category is no longer on file."
      backLink={BACK_LINK}
      isEmpty
      empty={{
        title: "That category is gone",
        body: "It was deleted or merged into another one. Its rows now sit under whichever category they were moved to.",
      }}
    />
  );
}

export function FinanceCategoryPage() {
  const { categoryId = "" } = useParams();
  const navigate = useNavigate();
  const book = useFinanceBook();
  const merchants = useStore((s) => s.financeMerchants);
  const partnerName = useStore((s) => s.partnerName);

  const [range, setRange] = useState<CategoryChartRange>("12");
  const [isEditing, setIsEditing] = useState(false);

  // One clock read for the page's life, so a re-render never re-derives against a moved "now".
  const asOf = useMemo(() => new Date(), []);
  const month = toMonthKey(asOf);
  const category = book.financeCategories.find((entry) => entry.id === categoryId) ?? null;

  const months = useMemo(
    () => listCategoryMonths(book, categoryId, month, RANGE_MONTHS[range]),
    [book, categoryId, month, range],
  );
  const series = useMemo(
    () => computeCategoryMonthlySeries(book, categoryId, months, asOf),
    [book, categoryId, months, asOf],
  );

  if (category === null) return <CategoryNotFound />;

  const color = getCategoryColor(category);
  const budgetCents = resolveEffectiveBudgets(book, month).get(categoryId)?.cents ?? null;
  const spentCents = computeBorneSpendByCategory(book, month).get(categoryId) ?? 0;
  const elapsedFraction = computeMonthElapsedFraction(month, asOf);

  const breachDay = computeCategoryBreachDays(
    book,
    month,
    new Map(budgetCents === null ? [] : [[categoryId, budgetCents]]),
  ).get(categoryId);
  const headline = describeCategoryHeadline({
    spentCents,
    budgetCents,
    breachedOn:
      breachDay === undefined
        ? null
        : format(parseISO(`${month}-${String(breachDay).padStart(2, "0")}`), "MMM d"),
  });

  const caption = computeCategoryCaptionFigures(book, categoryId, months, asOf);
  const rowFigures = computeCategoryMonthRowFigures(book, categoryId, month);
  const concentration = computeMerchantConcentration(book, categoryId, month, TOP_MERCHANTS);

  const monthRows = selectCategoryMonthRows(book, categoryId, month);
  const lookups = buildLedgerLookups({
    categories: book.financeCategories,
    merchants,
    transactions: book.financeTransactions,
    settledMonths: listSettledMonths(book.financeSettlements),
    partnerName,
  });
  const views = monthRows.slice(0, VISIBLE_ROWS).map((txn) => buildLedgerRowView(txn, lookups));

  const figures =
    series.status === "ok" &&
    caption.status === "ok" &&
    rowFigures.status === "ok" &&
    concentration.status === "ok"
      ? {
          series: series.figures,
          caption: caption.figures,
          month: rowFigures.figures,
          concentration: concentration.figures,
        }
      : null;

  return (
    <>
      <FinancePageShell
        title={
          <span className="flex items-center gap-[11px]">
            <span
              aria-hidden
              className="size-3.5 shrink-0 rounded-[4px]"
              style={{ background: color }}
            />
            {category.name || "(unnamed)"}
          </span>
        }
        subLine={
          <span className={cx(headline.isOver ? "text-danger" : "text-muted")}>
            {headline.text}
          </span>
        }
        backLink={BACK_LINK}
        headerAction={
          <>
            <HeroButton variant="ghost" className={SECONDARY} onPress={() => setIsEditing(true)}>
              Edit category
            </HeroButton>
            <HeroButton variant="primary" onPress={() => navigate("/finance/transactions/new")}>
              <Icon name="plus" size={16} />
              Add transaction
            </HeroButton>
          </>
        }
      >
        {figures === null ? (
          <FinanceNotice
            tone="warning"
            title="These figures could not be derived"
            body="A row in this category carries a date this app cannot read, so the page shows nothing rather than something wrong."
          />
        ) : (
          <div className="mt-4 flex flex-col gap-4">
            <div className="grid gap-3 lg:grid-cols-[1fr_20rem]">
              <CategoryMonthsChart
                series={figures.series}
                caption={figures.caption}
                budgetCents={budgetCents}
                color={color}
                range={range}
                onSelectRange={setRange}
              />
              <div className="flex flex-col gap-3">
                <CategoryMonthCard
                  spentCents={spentCents}
                  budgetCents={budgetCents}
                  color={color}
                  elapsedFraction={elapsedFraction}
                  rowFigures={figures.month}
                  categoryName={category.name}
                />
                <CategoryConcentrationCard
                  figures={figures.concentration}
                  merchants={merchants}
                  color={color}
                />
              </div>
            </div>

            <CategoryRowsCard
              views={views}
              hiddenCount={Math.max(monthRows.length - views.length, 0)}
              month={month}
            />
          </div>
        )}
      </FinancePageShell>

      {isEditing && <CategoryEditorModal category={category} onClose={() => setIsEditing(false)} />}
    </>
  );
}
