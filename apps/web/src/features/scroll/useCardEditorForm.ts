import { useEffect, useRef, useState } from "react";
import { useStore } from "@/core/store";
import type { EditorTextLengths } from "@/features/journal/editor/RichMarkdownEditor";
import type { MindCard, MindCardType } from "./model";
import { isFlippableByDefault } from "./model";

const EMPTY_BODY_LENGTHS: EditorTextLengths = { plainText: 0, capped: 0 };

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
    type: card?.type ?? "note",
    category: card?.category ?? "",
    source: card?.source ?? "",
    flippable: card?.flippable ?? true,
    learning: card ? card.box !== null : false,
  };
}

export function useCardEditorForm({
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
  const [bodyLengths, setBodyLengths] = useState<EditorTextLengths>(EMPTY_BODY_LENGTHS);
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
      setBodyLengths(EMPTY_BODY_LENGTHS);
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

  const requiresTitle = values.type === "note" && values.flippable;
  const canSave = requiresTitle
    ? values.title.trim().length > 0 && values.body.trim().length > 0
    : values.body.trim().length > 0;

  const handleSave = () => {
    if (!canSave) return;
    const fields = {
      title: values.title.trim(),
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
    openKey,
    values,
    setField,
    handleTypeChange,
    handleFlippableToggle,
    wasLearning: initialLearning.current,
    bodyTextLength: bodyLengths.plainText,
    bodyCappedLength: bodyLengths.capped,
    setBodyLengths,
    canSave,
    handleSave,
    handleDelete,
    isConfirmingDelete,
    setIsConfirmingDelete,
  };
}
