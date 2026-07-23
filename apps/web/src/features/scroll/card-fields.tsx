import { Button } from "@heroui/react";
import { useMemo } from "react";
import type { MindCard } from "./model";
import { listCategories } from "./queries";

export const FIELD_CLASS =
  "w-full rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

/** Category text input with up-to-6 existing-category suggestion buttons (click to fill). */
export function CategoryField({
  value,
  onChange,
  cards,
}: {
  value: string;
  onChange: (next: string) => void;
  cards: MindCard[];
}) {
  const suggestions = useMemo(() => {
    const query = value.trim().toLowerCase();
    return listCategories(cards)
      .filter((label) => label.toLowerCase() !== query && label.toLowerCase().includes(query))
      .slice(0, 6);
  }, [value, cards]);

  return (
    <div className="space-y-2">
      <input
        type="text"
        aria-label="Category"
        placeholder="Category"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className={FIELD_CLASS}
      />
      {suggestions.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {suggestions.map((label) => (
            <Button key={label} size="sm" variant="outline" onPress={() => onChange(label)}>
              {label}
            </Button>
          ))}
        </div>
      )}
    </div>
  );
}
