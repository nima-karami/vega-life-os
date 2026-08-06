/** "1 transaction" / "42 transactions" — the count and its noun, agreeing. */
export const pluralize = (count: number, noun: string): string =>
  `${count} ${noun}${count === 1 ? "" : "s"}`;
