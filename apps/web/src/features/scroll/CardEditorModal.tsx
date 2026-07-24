import { Button, Modal, useOverlayState } from "@heroui/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useStore } from "@/core/store";
import { ConfirmDialog, Icon, Select, type SelectOption, useCompactModal } from "@/core/ui";
import { CategoryField, FIELD_CLASS } from "./CategoryField";
import type { MindCard, MindCardType } from "./model";
import { isFlippableByDefault, MIND_CARD_TYPE_LABELS } from "./model";

const TITLE_MAX = 160;
const BODY_MAX = 600;
const COUNTER_NEAR = 40;

function CharCounter({ length, max }: { length: number; max: number }) {
  if (length <= max - COUNTER_NEAR) return null;
  return <span className="text-xs text-muted tabular-nums">{`${length}/${max}`}</span>;
}

function AutoGrowTextarea({
  value,
  onChange,
  ariaLabel,
  placeholder,
  maxLength,
}: {
  value: string;
  onChange: (next: string) => void;
  ariaLabel: string;
  placeholder: string;
  maxLength: number;
}) {
  const fitToContent = useCallback((el: HTMLTextAreaElement | null) => {
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);
  return (
    <textarea
      ref={fitToContent}
      aria-label={ariaLabel}
      placeholder={placeholder}
      value={value}
      rows={2}
      maxLength={maxLength}
      onChange={(event) => {
        fitToContent(event.currentTarget);
        onChange(event.target.value);
      }}
      className={`${FIELD_CLASS} max-h-48 resize-none overflow-y-auto leading-relaxed`}
    />
  );
}

const TYPE_OPTIONS: SelectOption[] = Object.entries(MIND_CARD_TYPE_LABELS).map(
  ([value, label]) => ({ value, label }),
);

interface CardFormValues {
  title: string;
  body: string;
  type: MindCardType;
  category: string;
  source: string;
  flippable: boolean;
  learning: boolean;
}

function readCardFields(card: MindCard | null): CardFormValues {
  return {
    title: card?.title ?? "",
    body: card?.body ?? "",
    type: card?.type ?? "model",
    category: card?.category ?? "",
    source: card?.source ?? "",
    flippable: card?.flippable ?? true,
    learning: card ? card.box !== null : false,
  };
}

function useCardEditorForm({
  cardId,
  isOpen,
  onClose,
}: {
  cardId: string | null;
  isOpen: boolean;
  onClose: () => void;
}) {
  const cards = useStore((s) => s.mindCards);
  const addMindCard = useStore((s) => s.addMindCard);
  const updateMindCard = useStore((s) => s.updateMindCard);
  const removeMindCard = useStore((s) => s.removeMindCard);
  const setMindCardLearning = useStore((s) => s.setMindCardLearning);
  const pushToast = useStore((s) => s.pushToast);

  const card = cardId ? (cards.find((c) => c.id === cardId) ?? null) : null;
  const isCreate = cardId === null;

  const [values, setValues] = useState<CardFormValues>(() => readCardFields(card));
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const initialLearning = useRef(false);

  const openKey = isOpen ? (cardId ?? "new") : null;
  const prevKey = useRef<string | null>(null);
  if (prevKey.current !== openKey) {
    prevKey.current = openKey;
    if (isOpen) {
      const fresh = readCardFields(card);
      initialLearning.current = fresh.learning;
      setValues(fresh);
      setIsConfirmingDelete(false);
    }
  }

  const setField = <K extends keyof CardFormValues>(key: K, next: CardFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: next }));

  const handleTypeChange = (type: MindCardType) => {
    const flippable = isFlippableByDefault(type);
    setValues((current) => ({
      ...current,
      type,
      flippable,
      learning: flippable ? current.learning : false,
    }));
  };

  const handleFlippableToggle = () => {
    setValues((current) => ({
      ...current,
      flippable: !current.flippable,
      learning: current.flippable ? false : current.learning,
    }));
  };

  useEffect(() => {
    if (isOpen && cardId !== null && card === null) {
      pushToast("Card no longer exists");
      onClose();
    }
  }, [isOpen, cardId, card, onClose, pushToast]);

  const handleSave = () => {
    const title = values.title.trim();
    if (!title) return;
    const fields = {
      title,
      body: values.body,
      type: values.type,
      category: values.category.trim(),
      source: values.source.trim() || null,
      flippable: values.flippable,
    };
    try {
      if (isCreate) {
        const created = addMindCard(fields);
        if (values.learning) setMindCardLearning(created.id, true);
      } else if (cardId) {
        updateMindCard(cardId, fields);
        if (values.learning !== initialLearning.current)
          setMindCardLearning(cardId, values.learning);
      }
      onClose();
    } catch {
      pushToast("Couldn't save — try again");
    }
  };

  const handleDelete = () => {
    setIsConfirmingDelete(false);
    onClose();
    if (cardId) removeMindCard(cardId);
  };

  return {
    cards,
    isCreate,
    values,
    setField,
    handleTypeChange,
    handleFlippableToggle,
    wasLearning: initialLearning.current,
    handleSave,
    handleDelete,
    isConfirmingDelete,
    setIsConfirmingDelete,
  };
}

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
    values,
    setField,
    handleTypeChange,
    handleFlippableToggle,
    wasLearning,
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

  const canSave = values.title.trim().length > 0;
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

                <label className="block space-y-2.5">
                  <span className="flex items-center justify-between">
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

                <div className="space-y-2.5">
                  <span className="flex items-center justify-between">
                    <span className="text-xs text-muted">Body</span>
                    <CharCounter length={values.body.length} max={BODY_MAX} />
                  </span>
                  <AutoGrowTextarea
                    value={values.body}
                    onChange={(body) => setField("body", body)}
                    ariaLabel="Card body"
                    placeholder="Explain it well…"
                    maxLength={BODY_MAX}
                  />
                </div>

                <label className="block space-y-2.5">
                  <span className="text-xs text-muted">Source</span>
                  <input
                    type="text"
                    aria-label="Source"
                    placeholder="Where it came from (optional)"
                    value={values.source}
                    onChange={(event) => setField("source", event.target.value)}
                    className={FIELD_CLASS}
                  />
                </label>

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
                  <Button size="sm" variant="primary" isDisabled={!canSave} onPress={handleSave}>
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
