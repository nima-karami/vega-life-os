import { Button, ButtonGroup } from "@heroui/react";
import { useLocation, useNavigate } from "react-router";
import type { IconName } from "@/core/lib/icon-names";
import { Icon } from "@/core/ui";

interface FinanceView {
  to: string;
  label: string;
  icon: IconName;
}

const FINANCE_VIEWS: FinanceView[] = [
  { to: "/finance", label: "Overview", icon: "wallet" },
  { to: "/finance/transactions", label: "Transactions", icon: "receipt" },
  { to: "/finance/import", label: "Import", icon: "upload" },
  { to: "/finance/categories", label: "Categories & budgets", icon: "tag" },
  { to: "/finance/settlement", label: "Settlement", icon: "handshake" },
];

function findCurrentView(pathname: string): FinanceView | undefined {
  return FINANCE_VIEWS.find((view) => view.to === pathname);
}

/**
 * Finance is one door with five rooms — the command bar drops you at Overview and this strip
 * carries you between them. Overflows sideways inside itself so 320px never scrolls the page.
 */
export function FinanceViewNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const currentView = findCurrentView(pathname);

  return (
    <nav aria-label="Finance views" className="-mx-4 mt-4 overflow-x-auto px-4">
      <ButtonGroup className="w-max">
        {FINANCE_VIEWS.map((view) => {
          const isCurrent = view === currentView;
          return (
            <Button
              key={view.to}
              size="sm"
              variant={isCurrent ? "primary" : "secondary"}
              aria-pressed={isCurrent}
              onPress={() => navigate(view.to)}
              className="shrink-0"
            >
              <Icon name={view.icon} size={14} />
              {view.label}
            </Button>
          );
        })}
      </ButtonGroup>
      <span aria-live="polite" aria-atomic="true" className="sr-only">
        {currentView ? `${currentView.label} — finance` : ""}
      </span>
    </nav>
  );
}
