import { isSameCategory, type MindCard } from "./model";

export type CardFilter = "all" | "learning" | "regular" | "hidden";
export type CardSortColumn = "title" | "type" | "category" | "status" | "addedAt";
export type CardSort = { column: CardSortColumn; direction: "asc" | "desc" };

export const DEFAULT_CARD_SORT: CardSort = { column: "addedAt", direction: "desc" };

const collator = new Intl.Collator();

const MAX_TITLE = 200;
const MAX_BODY = 2000;

const matchesFilter = (card: MindCard, filter: CardFilter): boolean => {
  switch (filter) {
    case "learning":
      return card.box !== null;
    case "regular":
      return card.box === null && card.hiddenAt === null;
    case "hidden":
      return card.hiddenAt !== null;
    default:
      return card.hiddenAt === null;
  }
};

const compareNewest = (a: MindCard, b: MindCard): number =>
  b.addedAt.localeCompare(a.addedAt) || b.id.localeCompare(a.id);

const compareStatus = (a: MindCard, b: MindCard): number => {
  if ((a.box === null) !== (b.box === null)) return a.box === null ? 1 : -1;
  if (a.box !== null && b.box !== null && a.box !== b.box) return b.box - a.box;
  return 0;
};

const compareByColumn = (column: CardSortColumn, a: MindCard, b: MindCard): number => {
  switch (column) {
    case "title":
      return collator.compare(a.title, b.title);
    case "type":
      return collator.compare(a.type, b.type);
    case "category":
      return collator.compare(a.category, b.category);
    case "status":
      return compareStatus(a, b);
    case "addedAt":
      return a.addedAt.localeCompare(b.addedAt);
  }
};

export function queryMindCards(
  cards: MindCard[],
  options: { query: string; filter: CardFilter; sort: CardSort; category: string | null },
): MindCard[] {
  const normalizedQuery = options.query.trim().toLowerCase();

  const rows = cards.filter((card) => {
    if (!matchesFilter(card, options.filter)) return false;
    if (options.category !== null && !isSameCategory(card.category, options.category)) return false;
    if (normalizedQuery) {
      const haystack = `${card.title} ${card.body}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) return false;
    }
    return true;
  });

  return rows.sort((a, b) => {
    const ordered = compareByColumn(options.sort.column, a, b);
    return (options.sort.direction === "asc" ? ordered : -ordered) || compareNewest(a, b);
  });
}

export function computeStats(
  cards: MindCard[],
  today: string,
): { cards: number; learning: number; dueToday: number } {
  let learning = 0;
  let dueToday = 0;
  for (const card of cards) {
    if (card.box !== null) learning++;
    if (card.nextDue !== null && card.nextDue <= today) dueToday++;
  }
  return { cards: cards.length, learning, dueToday };
}

export function listCategories(cards: MindCard[]): string[] {
  const firstCasingByKey = new Map<string, string>();
  for (const card of cards) {
    const label = card.category.trim();
    if (!label) continue;
    const key = label.toLowerCase();
    if (!firstCasingByKey.has(key)) firstCasingByKey.set(key, label);
  }
  return [...firstCasingByKey.values()].sort((a, b) => collator.compare(a, b));
}

export function parseBulkImport(text: string): {
  cards: { title: string; body: string }[];
  skipped: number;
  overLength: number;
} {
  const cards: { title: string; body: string }[] = [];
  const seenLines = new Set<string>();
  let skipped = 0;
  let overLength = 0;

  for (const rawLine of text.split("\n")) {
    const line = rawLine.trim();
    if (!line || seenLines.has(line)) {
      skipped++;
      continue;
    }
    seenLines.add(line);

    const separator = line.indexOf("::");
    const title = separator === -1 ? line : line.slice(0, separator).trim();
    const body = separator === -1 ? "" : line.slice(separator + 2).trim();

    if (title.length > MAX_TITLE || body.length > MAX_BODY) {
      overLength++;
      continue;
    }
    cards.push({ title, body });
  }

  return { cards, skipped, overLength };
}
