import { describe, expect, it } from "vitest";
import { deriveAccountSlug } from "../account-slug";
import { buildAccount } from "../row-builders";

const withSlugs = (...slugs: string[]) => slugs.map((slug) => buildAccount({ slug }));

describe("deriving an account slug from its name", () => {
  it("lowercases and hyphenates the words", () => {
    expect(deriveAccountSlug("Everyday chequing", [])).toBe("everyday-chequing");
  });

  it("drops punctuation runs to a single hyphen", () => {
    expect(deriveAccountSlug("Maple — Chequing (Shared)", [])).toBe("maple-chequing-shared");
  });

  it("collapses padding and repeated spaces", () => {
    expect(deriveAccountSlug("  TD   Visa  ", [])).toBe("td-visa");
  });

  it("strips combining marks so an accent survives as its base letter", () => {
    expect(deriveAccountSlug("Café Épargne", [])).toBe("cafe-epargne");
  });

  it("falls back to `account` when nothing sluggable is left", () => {
    expect(deriveAccountSlug("💳", [])).toBe("account");
  });

  it("truncates to 40 characters and re-trims the cut hyphen", () => {
    expect(deriveAccountSlug("Everyday chequing account for household spending", [])).toBe(
      "everyday-chequing-account-for-household",
    );
  });
});

describe("keeping a derived slug clear of the ones already held", () => {
  it("appends -2 on the first collision", () => {
    expect(deriveAccountSlug("Everyday chequing", withSlugs("everyday-chequing"))).toBe(
      "everyday-chequing-2",
    );
  });

  it("keeps counting past the first suffix", () => {
    expect(
      deriveAccountSlug("Everyday chequing", withSlugs("everyday-chequing", "everyday-chequing-2")),
    ).toBe("everyday-chequing-3");
  });

  it("suffixes a name that already ends in a number", () => {
    expect(deriveAccountSlug("everyday-chequing-2", withSlugs("everyday-chequing-2"))).toBe(
      "everyday-chequing-2-2",
    );
  });

  it("counts an archived account, whose slug a restore would bring back", () => {
    const archived = [buildAccount({ slug: "everyday-chequing", archivedAt: "2026-09-01" })];
    expect(deriveAccountSlug("Everyday chequing", archived)).toBe("everyday-chequing-2");
  });
});
