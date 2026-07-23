import { Button, Modal, useOverlayState } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/core/store";
import { ConfirmDialog, Icon, useCompactModal } from "@/core/ui";
import { RichJournalEditor } from "@/features/journal/editor";
import { CategoryField, FIELD_CLASS } from "./CategoryField";
import type { MindCard } from "./model";

const TITLE_HINT = 280;
const BODY_HINT = 500;

interface CardFormValues {
  title: string;
  body: string;
  category: string;
  source: string;
  learning: boolean;
}

function readCardFields(card: MindCard | null): CardFormValues {
  return {
    title: card?.title ?? "",
    body: card?.body ?? "",
    category: card?.category ?? "",
    source: card?.source ?? "",
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

  const handleSave = () => {
    const title = values.title.trim();
    if (!title) return;
    const fields = {
      title,
      body: values.body,
      category: values.category.trim(),
      source: values.source.trim() || null,
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
    if (cardId) removeMindCard(cardId);
    setIsConfirmingDelete(false);
    onClose();
  };

  return {
    cards,
    isCreate,
    values,
    setField,
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
  const isOverLong = values.title.length > TITLE_HINT || values.body.length > BODY_HINT;
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
                <label className="block space-y-2.5">
                  <span className="text-xs text-muted">Title</span>
                  <input
                    ref={titleRef}
                    type="text"
                    aria-label="Card title"
                    placeholder="Name the idea"
                    value={values.title}
                    onChange={(event) => setField("title", event.target.value)}
                    className={FIELD_CLASS}
                  />
                </label>

                <div className="space-y-2.5">
                  <span className="text-xs text-muted">Body</span>
                  <RichJournalEditor
                    value={values.body}
                    onChange={(body) => setField("body", body)}
                    ariaLabel="Card body"
                    placeholder="Explain it well… type / for commands"
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
                  <span className="text-xs text-muted">Review</span>
                  <Button
                    size="sm"
                    aria-pressed={values.learning}
                    variant={values.learning ? "primary" : "outline"}
                    onPress={() => setField("learning", !values.learning)}
                  >
                    <Icon name="brain" size={14} />
                    Learning mode
                  </Button>
                </div>

                {isOverLong && (
                  <p className="text-xs text-muted">Long card — consider trimming for the feed.</p>
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
