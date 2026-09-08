import { Button } from "@heroui/react";
import type { CardTypeId, SlotId } from "@vega/shared";
import { useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useStore } from "@/core/store";
import { readDraftPrefill } from "../draft-prefill";
import { listCardCategories } from "../queries";
import { CardFieldStack } from "./CardFieldStack";
import { CardPageFrame } from "./CardPageFrame";
import {
  type CardDraft,
  changeDraftType,
  createEmptyDraft,
  isDraftComplete,
  setDraftSlot,
  toCardCreate,
  toPreviewCard,
} from "./card-draft";
import { DraftReviewControl } from "./DraftReviewControl";

/**
 * A draft is held in memory until Save. Writing on the first valid keystroke meant a
 * mis-tapped "New card" left a real row behind, which is not a thing a user can undo by
 * changing their mind.
 */
export function NewCardPage() {
  const cards = useStore((s) => s.cards);
  const addCard = useStore((s) => s.addCard);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [draft, setDraft] = useState<CardDraft>(() => {
    const prefill = readDraftPrefill(`?${searchParams.toString()}`);
    const empty = createEmptyDraft();
    if (prefill === null) return empty;
    return { ...changeDraftType(empty, prefill.type), title: prefill.title };
  });
  const categories = useMemo(() => listCardCategories(cards), [cards]);
  const canSave = isDraftComplete(draft);
  const preview = toPreviewCard(draft);

  // The route replaces itself with the written card, so a second save is always a duplicate.
  const hasSavedRef = useRef(false);

  const handleSave = () => {
    if (!canSave || hasSavedRef.current) return;
    hasSavedRef.current = true;
    const created = addCard(toCardCreate(draft));
    navigate(`/cards/${created.id}`, { replace: true });
  };

  const saveButton = (
    <Button
      size="sm"
      variant="primary"
      isDisabled={!canSave}
      onPress={handleSave}
      className="h-11 lg:h-auto"
    >
      Save card
    </Button>
  );

  return (
    <CardPageFrame
      preview={preview}
      headerAction={saveButton}
      footer={
        <footer className="mt-3 flex items-center justify-end gap-2 border-border border-t pt-3.5 sm:mt-9 sm:pt-5">
          <Button size="sm" variant="ghost" onPress={() => navigate("/cards")}>
            Cancel
          </Button>
          {saveButton}
        </footer>
      }
    >
      <CardFieldStack
        values={draft}
        categories={categories}
        review={
          <DraftReviewControl
            card={preview.card}
            onToggle={(learning) => setDraft({ ...draft, learning })}
          />
        }
        onTypeChange={(next: CardTypeId) => setDraft(changeDraftType(draft, next))}
        onSlotChange={(slot: SlotId, value) => setDraft(setDraftSlot(draft, slot, value))}
        onCategoryChange={(category) => setDraft({ ...draft, category })}
      />
    </CardPageFrame>
  );
}
