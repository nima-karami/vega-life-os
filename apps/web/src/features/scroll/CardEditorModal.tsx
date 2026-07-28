import { Button, Modal, useOverlayState } from "@heroui/react";
import { useEffect, useRef } from "react";
import { ConfirmDialog, Icon, Select, type SelectOption, useCompactModal } from "@/core/ui";
import { CardBodyField } from "./CardBodyField";
import { CategoryField, FIELD_CLASS } from "./CategoryField";
import { CharCounter } from "./CharCounter";
import { MIND_CARD_TYPE_LABELS, type MindCardType } from "./model";
import { useCardEditorForm } from "./useCardEditorForm";

const TITLE_MAX = 160;

const TYPE_OPTIONS: SelectOption[] = Object.entries(MIND_CARD_TYPE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

const TYPE_FIELDS: Record<MindCardType, { title: boolean; source: boolean; behavior: boolean }> = {
  note: { title: true, source: true, behavior: true },
  quote: { title: false, source: true, behavior: false },
  prompt: { title: false, source: false, behavior: false },
};

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
    setField,
    handleTypeChange,
    handleFlippableToggle,
    wasLearning,
    bodyCappedLength,
    setBodyLengths,
    canSave,
    handleSave,
    handleDelete,
    isConfirmingDelete,
    setIsConfirmingDelete,
  } = useCardEditorForm({ cardId, isOpen, onClose });

  const titleRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isOpen && isCreate) titleRef.current?.focus();
  }, [isOpen, isCreate]);

  const responsive = useCompactModal();
  const state = useOverlayState({
    isOpen,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
  });

  const visibleFields = TYPE_FIELDS[values.type];
  const isQuote = values.type === "quote";
  const sourceLabel = isQuote ? "Attribution" : "Source";
  const sourcePlaceholder = isQuote ? "Who said it (optional)" : "Where it came from (optional)";
  const heading = isCreate ? "New card" : "Edit card";

  return (
    <>
      <Modal state={state}>
        <Modal.Backdrop variant="blur">
          <Modal.Container {...responsive}>
            <Modal.Dialog aria-label={heading}>
              <Modal.Header>
                <Modal.Heading className="text-base font-semibold text-foreground">
                  {heading}
                </Modal.Heading>
              </Modal.Header>

              <Modal.Body className="space-y-5">
                <div className="space-y-2.5">
                  <span className="text-xs text-muted">Type</span>
                  <Select
                    ariaLabel="Card type"
                    value={values.type}
                    onValueChange={(type) => handleTypeChange(type as MindCardType)}
                    options={TYPE_OPTIONS}
                  />
                </div>

                <div className="space-y-2.5">
                  <span className="text-xs text-muted">Category</span>
                  <CategoryField
                    value={values.category}
                    onChange={(category) => setField("category", category)}
                    cards={cards}
                  />
                </div>

                {visibleFields.title && (
                  <label className="block space-y-2.5">
                    <span className="flex items-center gap-2">
                      <span className="text-xs text-muted">Title</span>
                      <CharCounter length={values.title.length} max={TITLE_MAX} />
                    </span>
                    <input
                      ref={titleRef}
                      type="text"
                      aria-label="Card title"
                      placeholder="Name the idea"
                      value={values.title}
                      maxLength={TITLE_MAX}
                      onChange={(event) => setField("title", event.target.value)}
                      className={FIELD_CLASS}
                    />
                  </label>
                )}

                <CardBodyField
                  key={`${openKey}:${values.type}`}
                  type={values.type}
                  value={values.body}
                  cappedLength={bodyCappedLength}
                  onChange={(body) => setField("body", body)}
                  onLengthChange={setBodyLengths}
                  onSubmit={handleSave}
                />

                {visibleFields.source && (
                  <label className="block space-y-2.5">
                    <span className="text-xs text-muted">{sourceLabel}</span>
                    <input
                      type="text"
                      aria-label={sourceLabel}
                      placeholder={sourcePlaceholder}
                      value={values.source}
                      onChange={(event) => setField("source", event.target.value)}
                      className={FIELD_CLASS}
                    />
                  </label>
                )}

                {visibleFields.behavior && (
                  <div className="space-y-2.5">
                    <span className="text-xs text-muted">Behavior</span>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        aria-pressed={values.flippable}
                        variant={values.flippable ? "primary" : "outline"}
                        onPress={handleFlippableToggle}
                      >
                        <Icon name="repeat" size={14} />
                        Flippable
                      </Button>
                      <Button
                        size="sm"
                        aria-pressed={values.learning}
                        isDisabled={!values.flippable}
                        variant={values.learning ? "primary" : "outline"}
                        onPress={() => setField("learning", !values.learning)}
                      >
                        <Icon name="brain" size={14} />
                        Learning mode
                      </Button>
                    </div>
                    {!values.flippable && (
                      <p className="text-xs text-muted">
                        {wasLearning
                          ? "Saving ends this card's learning — reviews need a hidden back."
                          : "Learning needs a flippable card."}
                      </p>
                    )}
                  </div>
                )}
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
