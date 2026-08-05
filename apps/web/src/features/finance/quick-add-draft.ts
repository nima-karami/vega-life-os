/**
 * Turning what the owner typed into a form. The ⌘K command can only hand over one free-text
 * string, so an amount is teased out of it best-effort — a miss just leaves the field empty.
 */
export interface QuickAddDraft {
  amountInput: string;
  description: string;
}

const MONEY_TOKEN = /^\$?\d{1,3}(?:,\d{3})+(?:\.\d{1,2})?$|^\$?\d+(?:\.\d{1,2})?$/;
const PLAIN_DECIMAL = /^(\d*)(?:\.(\d*))?$/;

/** Decimal text → an integer scaled by `decimals`, digit by digit so no float touches money. */
function parseScaledDecimal(input: string, decimals: number): number | null {
  const match = PLAIN_DECIMAL.exec(input.replace(/[$,\s]/g, ""));
  if (!match) return null;
  const whole = match[1] ?? "";
  const fraction = match[2] ?? "";
  if (whole === "" && fraction === "") return null;
  if (fraction.length > decimals) return null;
  const scaled = Number(`${whole || "0"}${fraction.padEnd(decimals, "0")}`);
  return Number.isSafeInteger(scaled) ? scaled : null;
}

export const parseAmountToCents = (input: string): number | null => parseScaledDecimal(input, 2);

/** Percent text → basis points: `50` is 5000, and `62.5` is exactly 6250. */
export const parseSharePercentToBps = (input: string): number | null =>
  parseScaledDecimal(input, 2);

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
