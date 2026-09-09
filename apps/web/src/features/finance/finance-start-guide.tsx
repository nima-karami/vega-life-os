import { Button } from "@heroui/react";
import type { EmptyCopy } from "@/core/ui";
import { TOUCH_BUTTON_HEIGHT_CLASS } from "./primitives";

const IMPORT_ROUTE = "/finance/import";
const NEW_TRANSACTION_ROUTE = "/finance/transactions/new";

const NO_ACCOUNT_TITLE = "Set up your first account";
const NO_ACCOUNT_BODY =
  "Statements import into an account, so name the first one — a chequing account, a card, whatever you actually file.";

const SURFACE_COPY = {
  overview: {
    title: "Nothing imported yet",
    body: "Import a bank statement to start the weekly loop: import, categorise and split, then settle.",
  },
  ledger: {
    title: "No transactions yet",
    body: "Import a statement, or add one by hand from the command bar.",
  },
} as const;

export type FinanceStartSurface = keyof typeof SURFACE_COPY;

export interface FinanceStartGuideOptions {
  surface: FinanceStartSurface;
  /** false → step one is naming an account, so the first CTA opens the editor */
  hasOpenAccount: boolean;
  onAddAccount: () => void;
  navigate: (to: string) => void;
}

/** The one two-step first-run guide both money surfaces render, so neither owns a copy of it. */
export function buildFinanceStartGuide({
  surface,
  hasOpenAccount,
  onAddAccount,
  navigate,
}: FinanceStartGuideOptions): EmptyCopy {
  const step = hasOpenAccount
    ? { label: "Import statements", act: () => navigate(IMPORT_ROUTE) }
    : { label: "Add an account", act: onAddAccount };

  return {
    ...(hasOpenAccount
      ? SURFACE_COPY[surface]
      : { title: NO_ACCOUNT_TITLE, body: NO_ACCOUNT_BODY }),
    cta: (
      <div className="flex flex-wrap justify-center gap-2">
        <Button variant="secondary" className={TOUCH_BUTTON_HEIGHT_CLASS} onPress={step.act}>
          {step.label}
        </Button>
        <Button
          variant="secondary"
          className={TOUCH_BUTTON_HEIGHT_CLASS}
          onPress={() => navigate(NEW_TRANSACTION_ROUTE)}
        >
          Add a transaction by hand
        </Button>
      </div>
    ),
  };
}
