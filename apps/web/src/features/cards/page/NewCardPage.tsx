import type { CardTypeId, SlotId } from "@vega/shared";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useStore } from "@/core/store";
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
import { LiveCardPane } from "./LiveCardPane";

export function NewCardPage() {
  const cards = useStore((s) => s.cards);
  const addCard = useStore((s) => s.addCard);
  const navigate = useNavigate();
  const [draft, setDraft] = useState<CardDraft>(createEmptyDraft);
  const categories = useMemo(() => listCardCategories(cards), [cards]);

  // Nothing is persisted until the type's required slots are satisfied; then the
  // route replaces to the written card and every later edit goes through updateCard.
  const advance = (next: CardDraft) => {
    if (!isDraftComplete(next)) {
      setDraft(next);
      return;
    }
    const created = addCard(toCardCreate(next));
    navigate(`/cards/${created.id}`, { replace: true });
  };

  return (
    <CardPageFrame
      previewTo={null}
      footer={null}
      aside={<LiveCardPane card={toPreviewCard(draft)} />}
    >
      <CardFieldStack
        values={draft}
        categories={categories}
        review={null}
        onTypeChange={(next: CardTypeId) => setDraft(changeDraftType(draft, next))}
        onSlotChange={(slot: SlotId, value) => advance(setDraftSlot(draft, slot, value))}
        onCategoryChange={(category) => setDraft({ ...draft, category })}
      />
    </CardPageFrame>
  );
}
