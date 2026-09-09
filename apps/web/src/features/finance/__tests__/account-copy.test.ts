import { describe, expect, it } from "vitest";
import { describeAccountArchive, describeAccountKind, describeAccountMeta } from "../account-copy";
import { buildAccount } from "../row-builders";

describe("naming an account kind", () => {
  it("reads each of the three kinds as a sentence would", () => {
    expect(describeAccountKind("chequing")).toBe("Chequing");
    expect(describeAccountKind("savings")).toBe("Savings");
    expect(describeAccountKind("credit_card")).toBe("Credit card");
  });
});

describe("the accounts card's second line", () => {
  it("names the kind alone on a personal account", () => {
    expect(describeAccountMeta(buildAccount({ kind: "chequing" }))).toBe("Chequing");
  });

  it("adds Business to a business account", () => {
    expect(describeAccountMeta(buildAccount({ kind: "credit_card", isBusiness: true }))).toBe(
      "Credit card · Business",
    );
  });

  it("leaves archived to the row chip rather than repeating it", () => {
    expect(describeAccountMeta(buildAccount({ kind: "chequing", archivedAt: "2026-09-01" }))).toBe(
      "Chequing",
    );
    expect(
      describeAccountMeta(
        buildAccount({ kind: "savings", isBusiness: true, archivedAt: "2026-09-01" }),
      ),
    ).toBe("Savings · Business");
  });
});

describe("the archive confirm's body", () => {
  it("says there is nothing filed against an empty account", () => {
    expect(describeAccountArchive(0)).toBe(
      "Nothing is filed against it yet — it just stops being offered as an import target.",
    );
  });

  it("agrees its verb with a single transaction", () => {
    expect(describeAccountArchive(1)).toBe(
      "Its 1 transaction stays exactly where it is — it just stops being offered as an import target.",
    );
  });

  it("agrees its verb with many transactions", () => {
    expect(describeAccountArchive(412)).toBe(
      "Its 412 transactions stay exactly where they are — it just stops being offered as an import target.",
    );
  });
});
