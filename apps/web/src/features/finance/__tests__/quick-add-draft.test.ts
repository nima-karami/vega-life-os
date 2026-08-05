import { describe, expect, it } from "vitest";
import { parseAmountToCents, parseQuickAddDraft } from "../quick-add-draft";

describe("parseQuickAddDraft", () => {
  it("splits a trailing amount off the description", () => {
    expect(parseQuickAddDraft("Espresso 4.50")).toEqual({
      amountInput: "4.50",
      description: "Espresso",
    });
  });

  it("takes the last money token when the line has several numbers", () => {
    expect(parseQuickAddDraft("2 coffees at 7-11 12.75")).toEqual({
      amountInput: "12.75",
      description: "2 coffees at 7-11",
    });
  });

  it("reads a leading amount and a dollar sign", () => {
    expect(parseQuickAddDraft("$23 Lunch")).toEqual({ amountInput: "23", description: "Lunch" });
  });

  it("drops thousands separators", () => {
    expect(parseQuickAddDraft("Flights 1,240.00")).toEqual({
      amountInput: "1240.00",
      description: "Flights",
    });
  });

  it("leaves the amount empty when nothing looks like money", () => {
    expect(parseQuickAddDraft("  Pantryco run  ")).toEqual({
      amountInput: "",
      description: "Pantryco run",
    });
  });

  it("survives an empty query", () => {
    expect(parseQuickAddDraft("")).toEqual({ amountInput: "", description: "" });
  });
});

describe("parseAmountToCents", () => {
  it("reads whole dollars and cents as integer cents", () => {
    expect(parseAmountToCents("4.50")).toBe(450);
    expect(parseAmountToCents("112")).toBe(11200);
    expect(parseAmountToCents("0.05")).toBe(5);
    expect(parseAmountToCents(".7")).toBe(70);
  });

  it("ignores currency dressing", () => {
    expect(parseAmountToCents("$1,240.00")).toBe(124000);
    expect(parseAmountToCents(" 12.30 ")).toBe(1230);
  });

  it("rejects anything that is not a positive plain decimal", () => {
    expect(parseAmountToCents("")).toBeNull();
    expect(parseAmountToCents("abc")).toBeNull();
    expect(parseAmountToCents("4.567")).toBeNull();
  });

  // The field is a magnitude, so every way a statement writes a negative reads as no amount.
  it("refuses a negative however it is written", () => {
    expect(parseAmountToCents("-4.50")).toBeNull();
    expect(parseAmountToCents("−7.00")).toBeNull();
    expect(parseAmountToCents("(38.40)")).toBeNull();
  });
});
