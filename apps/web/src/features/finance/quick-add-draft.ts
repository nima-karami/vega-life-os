import { parseAmountCents } from "./import/fields";

/**
 * Turning what the owner typed into a form. The ⌘K command can only hand over one free-text
 * string, so an amount is teased out of it best-effort — a miss just leaves the field empty.
 */
export interface QuickAddDraft {
  amountInput: string;
  description: string;
}

const MONEY_TOKEN = /^\$?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$|^\$?\d+(?:\.\d{1,2})?$/;

/** The quick-add field is a magnitude — the row's sign comes from what it is, not what was typed. */
export const parseAmountToCents = (input: string): number | null => {
  const cents = parseAmountCents(input);
  return cents === null || cents < 0 ? null : cents;
};

/** The last money-looking token is the amount; whatever is left of the line is the description. */
export function parseQuickAddDraft(text: string): QuickAddDraft {
  const tokens = text
    .trim()
    .split(/\s+/)
    .filter((token) => token !== "");
  for (let index = tokens.length - 1; index >= 0; index -= 1) {
    const token = tokens[index];
    if (!MONEY_TOKEN.test(token)) continue;
    const rest = [...tokens.slice(0, index), ...tokens.slice(index + 1)];
    return { amountInput: token.replace(/[$,]/g, ""), description: rest.join(" ") };
  }
  return { amountInput: "", description: text.trim() };
}
