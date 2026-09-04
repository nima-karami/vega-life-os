import { describe, expect, it } from "vitest";
import { buildFinanceStartGuide, type FinanceStartSurface } from "../finance-start-guide";

const guide = (surface: FinanceStartSurface, hasOpenAccount: boolean) =>
  buildFinanceStartGuide({
    surface,
    hasOpenAccount,
    onAddAccount: () => {},
    navigate: () => {},
  });

describe("a book with no open account", () => {
  it("asks for the account first, on both money surfaces", () => {
    for (const surface of ["overview", "ledger"] as const) {
      const copy = guide(surface, false);
      expect(copy.title).toBe("Set up your first account");
      expect(copy.body).toBe(
        "Statements import into an account, so name the first one — a chequing account, a card, whatever you actually file.",
      );
      expect(copy.cta).not.toBeUndefined();
    }
  });
});

describe("a book with an account but nothing in it", () => {
  it("keeps the overview's own copy", () => {
    const copy = guide("overview", true);
    expect(copy.title).toBe("Nothing imported yet");
    expect(copy.body).toBe(
      "Import a bank statement to start the weekly loop: import, categorise and split, then settle.",
    );
  });

  it("keeps the ledger's own copy", () => {
    const copy = guide("ledger", true);
    expect(copy.title).toBe("No transactions yet");
    expect(copy.body).toBe("Import a statement, or add one by hand from the command bar.");
  });
});
