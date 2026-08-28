import type { Card, CardTypeId, SlotId } from "@vega/shared";
import { useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useStore } from "@/core/store";
import { ConfirmDialog, Icon } from "@/core/ui";
import {
  buildTypeChangeConfirmBody,
  buildTypeChangePatch,
  losesReviewOnTypeChange,
} from "../card-type-change";
import { listCardCategories } from "../queries";
import { CardFieldStack } from "./CardFieldStack";
import { CardPageFooter } from "./CardPageFooter";
import { CardPageFrame } from "./CardPageFrame";
import { setDraftSlot, toCardPatch, toDraft } from "./card-draft";
import type { CardPageLocationState } from "./card-page-nav";
import { fillSampleSlots } from "./card-sample";
import { FIELD_GROUP_CLASS } from "./field-classes";
import { LiveCardPane } from "./LiveCardPane";
import { NewCardPage } from "./NewCardPage";
import { ReviewControl } from "./ReviewControl";

export function CardPage() {
  const { cardId } = useParams();
  const isNew = cardId === undefined;
  const isReady = useStore((s) => s.ready);
  const card = useStore((s) => s.cards.find((c) => c.id === cardId));

  if (isNew) return <NewCardPage />;
  if (!isReady) return <CardPageSkeleton />;
  if (card === undefined) return <CardPageNotFound />;
  return <CardEditor card={card} />;
}

function CardPageSkeleton() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-8">
      <span className="inline-block h-4 w-16 animate-pulse rounded bg-surface-secondary" />
      {[0, 1, 2, 3].map((row) => (
        <div key={row} className={FIELD_GROUP_CLASS}>
          <span className="block h-3 w-20 animate-pulse rounded bg-surface-secondary" />
          <div className="mt-[9px] h-[46px] animate-pulse rounded-[12px] bg-surface-secondary sm:h-[42px]" />
        </div>
      ))}
    </div>
  );
}

function CardPageNotFound() {
  return (
    <div className="mx-auto max-w-6xl px-4 pt-6 pb-8">
      <p className="text-muted text-sm">This card no longer exists.</p>
      <Link
        to="/cards"
        className="mt-4 inline-flex items-center gap-1.5 text-accent text-sm hover:underline"
      >
        <Icon name="chevL" size={14} aria-hidden />
        Back to Cards
      </Link>
    </div>
  );
}

function CardEditor({ card }: { card: Card }) {
  const cards = useStore((s) => s.cards);
  const updateCard = useStore((s) => s.updateCard);
  const removeCard = useStore((s) => s.removeCard);
  const navigate = useNavigate();
  const categories = useMemo(() => listCardCategories(cards), [cards]);
  const values = useMemo(() => toDraft(card), [card]);
  const preview = useMemo(() => fillSampleSlots(card), [card]);
  const [pendingType, setPendingType] = useState<CardTypeId | null>(null);
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const applyType = (nextType: CardTypeId) =>
    updateCard(card.id, buildTypeChangePatch(card, nextType));

  const handleDelete = () => {
    const removed = card;
    removeCard(card.id);
    setIsConfirmingDelete(false);
    const state: CardPageLocationState = {
      cardUndo: { message: "Card deleted", card: removed },
    };
    navigate("/cards", { state });
  };

  return (
    <>
      <CardPageFrame
        previewTo={`/cards/${card.id}/preview`}
        footer={<CardPageFooter onDelete={() => setIsConfirmingDelete(true)} />}
        aside={<LiveCardPane preview={preview} />}
      >
        <CardFieldStack
          values={values}
          categories={categories}
          review={<ReviewControl card={card} />}
          onTypeChange={(nextType: CardTypeId) => {
            if (nextType === card.type) return;
            if (losesReviewOnTypeChange(card, nextType)) setPendingType(nextType);
            else applyType(nextType);
          }}
          onSlotChange={(slot: SlotId, value) =>
            updateCard(card.id, toCardPatch(setDraftSlot(values, slot, value)))
          }
          onCategoryChange={(category) => updateCard(card.id, { category })}
        />
      </CardPageFrame>

      <ConfirmDialog
        open={pendingType !== null}
        title="Change type?"
        body={pendingType === null ? "" : buildTypeChangeConfirmBody(pendingType)}
        confirmLabel="Change type"
        onConfirm={() => {
          if (pendingType !== null) applyType(pendingType);
          setPendingType(null);
        }}
        onClose={() => setPendingType(null)}
      />

      <ConfirmDialog
        open={isConfirmingDelete}
        danger
        title="Delete card?"
        body="This removes the card for good."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onClose={() => setIsConfirmingDelete(false)}
      />
    </>
  );
}
