import { Button, Modal, useOverlayState } from "@heroui/react";
import { CARD_TYPE_IDS, CARD_TYPES, type CardTypeId, listTypeSlots } from "@vega/shared";
import { useState } from "react";
import { todayISO } from "@/core/lib/date";
import {
  ConfirmDialog,
  cx,
  draftSafeBackdrop,
  Icon,
  Select,
  type SelectOption,
  useCompactModal,
} from "@/core/ui";
import { CardPreview } from "./CardPreview";
import { CardSlotField } from "./CardSlotField";
import { CategoryField } from "./CategoryField";
import { toFeedCard } from "./feed-cards";
import { toCardFields, useCardEditorForm } from "./useCardEditorForm";

const TYPE_OPTIONS: SelectOption[] = CARD_TYPE_IDS.map((value) => ({
  value,
  label: CARD_TYPES[value].label,
}));

export function CardEditorModal({
  cardId,
  isOpen,
  onClose,
}: {
  cardId: string | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const {
    cards,
    isCreate,
    openKey,
    values,
    setSlot,
    setCategory,
    handleTypeChange,
    handleRecallToggle,
    canPromoteDraft,
    isLearnableDraft,
    setLearning,
    canSave,
    handleSave,
    handleDelete,
    isConfirmingDelete,
    setIsConfirmingDelete,
  } = useCardEditorForm({ cardId, isOpen, onClose });

  const [isPreviewing, setIsPreviewing] = useState(false);

  const responsive = useCompactModal();
  const state = useOverlayState({
    isOpen,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
  });

  const heading = isCreate ? "New card" : "Edit card";
  const previewCard = toFeedCard(
    {
      ...toCardFields(values),
      id: "draft",
      addedAt: todayISO(),
      reviewCount: 0,
      updatedAt: "",
      fieldUpdatedAt: {},
    },
    todayISO(),
  );

  return (
    <>
      <Modal state={state}>
        <Modal.Backdrop variant="blur" {...draftSafeBackdrop}>
          <Modal.Container {...responsive}>
            <Modal.Dialog aria-label={heading}>
              <Modal.Header className="flex-row items-center justify-between gap-3">
                <Modal.Heading className="text-base font-semibold text-foreground">
                  {heading}
                </Modal.Heading>
                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    aria-pressed={!isPreviewing}
                    variant={isPreviewing ? "outline" : "primary"}
                    onPress={() => setIsPreviewing(false)}
                  >
                    Edit
                  </Button>
                  <Button
                    size="sm"
                    aria-pressed={isPreviewing}
                    variant={isPreviewing ? "primary" : "outline"}
                    onPress={() => setIsPreviewing(true)}
                  >
                    <Icon name="eye" size={14} />
                    Preview
                  </Button>
                </div>
              </Modal.Header>

              <Modal.Body>
                {isPreviewing && (
                  <CardPreview card={previewCard} className="mx-auto max-w-[300px]" />
                )}

                <div className={cx("space-y-5", isPreviewing && "hidden")}>
                  <div className="space-y-2.5">
                    <span className="text-xs text-muted">Type</span>
                    <Select
                      ariaLabel="Card type"
                      value={values.type}
                      onValueChange={(type) => handleTypeChange(type as CardTypeId)}
                      options={TYPE_OPTIONS}
                    />
                  </div>

                  {(canPromoteDraft || values.hasRecall) && (
                    <div className="space-y-2.5">
                      <span className="text-xs text-muted">Review</span>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          aria-pressed={values.hasRecall}
                          variant={values.hasRecall ? "primary" : "outline"}
                          onPress={handleRecallToggle}
                        >
                          <Icon name="repeat" size={14} />
                          Hide part of this to review it
                        </Button>
                        <Button
                          size="sm"
                          aria-pressed={values.learning}
                          isDisabled={!isLearnableDraft}
                          variant={values.learning ? "primary" : "outline"}
                          onPress={() => setLearning(!values.learning)}
                        >
                          <Icon name="brain" size={14} />
                          Learning mode
                        </Button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-2.5">
                    <span className="text-xs text-muted">Category</span>
                    <CategoryField value={values.category} onChange={setCategory} cards={cards} />
                  </div>

                  {listTypeSlots(values.type).map(([slot, def]) => (
                    <CardSlotField
                      key={`${openKey}:${slot}`}
                      slot={slot}
                      def={def}
                      value={values.slots[slot]}
                      onChange={(next) => setSlot(slot, next)}
                    />
                  ))}
                </div>
              </Modal.Body>

              <Modal.Footer className="justify-between">
                {isCreate ? (
                  <span />
                ) : (
                  <Button
                    size="sm"
                    variant="danger-soft"
                    onPress={() => setIsConfirmingDelete(true)}
                  >
                    <Icon name="trash" size={14} />
                    Delete
                  </Button>
                )}
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" onPress={onClose}>
                    Cancel
                  </Button>
                  <Button
                    size="sm"
                    variant="primary"
                    aria-keyshortcuts="Meta+Enter Control+Enter"
                    isDisabled={!canSave}
                    onPress={handleSave}
                  >
                    Save
                  </Button>
                </div>
              </Modal.Footer>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

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
