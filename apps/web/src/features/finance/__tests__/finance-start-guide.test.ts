import { isValidElement, type ReactElement, type ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { buildFinanceStartGuide, type FinanceStartSurface } from "../finance-start-guide";

interface GuideAction {
  children: ReactNode;
  onPress: () => void;
}

function readActions(cta: ReactNode): GuideAction[] {
  if (!isValidElement<{ children: ReactNode }>(cta))
    throw new Error("the guide offered no CTA row");
  const children = cta.props.children;
  return (Array.isArray(children) ? children : [children])
    .filter((child): child is ReactElement<GuideAction> => isValidElement<GuideAction>(child))
    .map((child) => child.props);
}

function buildGuide(surface: FinanceStartSurface, hasOpenAccount: boolean) {
  const pressed: string[] = [];
  const copy = buildFinanceStartGuide({
    surface,
    hasOpenAccount,
    onAddAccount: () => pressed.push("open-account-editor"),
    navigate: (to) => pressed.push(to),
  });
  return { copy, actions: readActions(copy.cta), pressed };
}

const labelsOf = (actions: GuideAction[]) => actions.map((action) => action.children);

describe("a book with no open account", () => {
  it("asks for the account first, on both money surfaces", () => {
    for (const surface of ["overview", "ledger"] as const) {
      const { copy } = buildGuide(surface, false);
      expect(copy.title).toBe("Set up your first account");
      expect(copy.body).toBe(
        "Statements import into an account, so name the first one — a chequing account, a card, whatever you actually file.",
      );
    }
  });

  it("leads with the account, and that button opens the editor", () => {
    for (const surface of ["overview", "ledger"] as const) {
      const { actions, pressed } = buildGuide(surface, false);
      expect(labelsOf(actions)).toEqual(["Add an account", "Add a transaction by hand"]);
      actions[0]?.onPress();
      expect(pressed).toEqual(["open-account-editor"]);
    }
  });
});

describe("a book with an account but nothing in it", () => {
  it("keeps the overview's own copy", () => {
    const copy = buildGuide("overview", true).copy;
    expect(copy.title).toBe("Nothing imported yet");
    expect(copy.body).toBe(
      "Import a bank statement to start the weekly loop: import, categorise and split, then settle.",
    );
  });

  it("keeps the ledger's own copy", () => {
    const copy = buildGuide("ledger", true).copy;
    expect(copy.title).toBe("No transactions yet");
    expect(copy.body).toBe("Import a statement, or add one by hand from the command bar.");
  });

  it("leads with the import instead, and still offers the hand-entry route", () => {
    const { actions, pressed } = buildGuide("overview", true);
    expect(labelsOf(actions)).toEqual(["Import statements", "Add a transaction by hand"]);
    actions[0]?.onPress();
    actions[1]?.onPress();
    expect(pressed).toEqual(["/finance/import", "/finance/transactions/new"]);
  });
});
