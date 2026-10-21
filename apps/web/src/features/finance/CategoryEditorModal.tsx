import { Button } from "@heroui/react";
import type { FinanceCategory } from "@vega/shared";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/core/store";
import { FIELD_CLASS, SegmentButton } from "@/core/ui";
import { FinanceModalFrame } from "./FinanceModalFrame";

const KINDS: { id: FinanceCategory["kind"]; label: string }[] = [
  { id: "spend", label: "Spend" },
  { id: "income", label: "Income" },
];

/** What a category *is* — the budget is edited in the row it is judged in, never in here. */
export function CategoryEditorModal({
  category,
  onClose,
}: {
  category: FinanceCategory | null;
  onClose: () => void;
}) {
  const addFinanceCategory = useStore((s) => s.addFinanceCategory);
  const updateFinanceCategory = useStore((s) => s.updateFinanceCategory);

  const [name, setName] = useState(category?.name ?? "");
  const [kind, setKind] = useState<FinanceCategory["kind"]>(category?.kind ?? "spend");

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const trimmedName = name.trim();
  const canSave = trimmedName !== "";

  const handleSave = () => {
    if (!canSave) return;
    if (category) updateFinanceCategory(category.id, { name: trimmedName, kind });
    else addFinanceCategory({ name: trimmedName, kind });
    onClose();
  };

  return (
    <FinanceModalFrame
      title={category ? "Category" : "New category"}
      onClose={onClose}
      footer={
        <>
          <Button size="sm" variant="ghost" onPress={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" isDisabled={!canSave} onPress={handleSave}>
            {category ? "Save" : "Create category"}
          </Button>
        </>
      }
    >
      <label className="block space-y-2">
        <span className="text-xs text-muted">Name</span>
        <input
          ref={nameRef}
          type="text"
          aria-label="Category name"
          value={name}
          placeholder="Groceries"
          onChange={(event) => setName(event.target.value)}
          className={FIELD_CLASS}
        />
      </label>

      <div className="space-y-2">
        <span className="text-xs text-muted">Kind</span>
        <div className="flex gap-2">
          {KINDS.map((option) => (
            <SegmentButton
              key={option.id}
              isSelected={kind === option.id}
              onClick={() => setKind(option.id)}
            >
              {option.label}
            </SegmentButton>
          ))}
        </div>
      </div>

      <p className="text-xs text-muted">
        {kind === "spend"
          ? "Set the monthly budget in the categories table. It writes against that month only, so earlier months keep the figure they were judged against."
          : "Income categories carry no budget. They show up in the month's in/out strip instead."}
      </p>
    </FinanceModalFrame>
  );
}
