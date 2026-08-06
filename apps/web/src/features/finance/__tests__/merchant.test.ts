import { describe, expect, it } from "vitest";
import { normalizeMerchant } from "../import/merchant";

describe("normalizeMerchant", () => {
  it("uppercases and collapses runs of whitespace", () => {
    expect(normalizeMerchant("  Shell   C-Store  ")).toBe("SHELL C-STORE");
  });

  it("strips a processor reference glued on with an asterisk", () => {
    expect(normalizeMerchant("Amzn Mktp CA*REF123")).toBe("AMZN MKTP CA");
    expect(normalizeMerchant("AMZN MKTP CA*REF456")).toBe("AMZN MKTP CA");
  });

  it("keeps a short asterisked token, which is a merchant name and not a reference", () => {
    expect(normalizeMerchant("SQ *THE COFFEE BAR ANYTOWN ON")).toBe("SQ *THE COFFEE BAR");
  });

  it("keeps a long asterisked token with no digit — Square puts merchant names there", () => {
    expect(normalizeMerchant("SQ *COFFEESHOP")).toBe("SQ *COFFEESHOP");
    expect(normalizeMerchant("SQ *BAKERY")).toBe("SQ *BAKERY");
    expect(normalizeMerchant("SQ *COFFEESHOP")).not.toBe(normalizeMerchant("SQ *BAKERY"));
  });

  it("strips runs of four or more digits", () => {
    expect(normalizeMerchant("BULKWAY WAREHOUSE W0000 ANYTOWN ON")).toBe("BULKWAY WAREHOUSE W");
  });

  it("strips the trailing city once a province code proves it is a place", () => {
    expect(normalizeMerchant("FRESHWAY SUPERMARKET ANYTOWN ON")).toBe("FRESHWAY SUPERMARKET");
  });

  it("leaves a trailing token alone when no province follows it", () => {
    expect(normalizeMerchant("Amzn Mktp CA")).toBe("AMZN MKTP CA");
  });

  it("never strips the last remaining token", () => {
    expect(normalizeMerchant("FLICKBOX ON")).toBe("FLICKBOX");
  });

  it("collapses a store number onto the bare merchant so both descriptions share a key", () => {
    expect(normalizeMerchant("BEANERY #12345 ANYTOWN ON")).toBe("BEANERY");
    expect(normalizeMerchant("BEANERY ANYTOWN ON")).toBe("BEANERY");
  });

  it("handles a realistic noisy card description", () => {
    expect(normalizeMerchant("SP  LANTERN  *AB12CDE   9012  ANYTOWN   ON")).toBe("SP LANTERN");
  });
});
