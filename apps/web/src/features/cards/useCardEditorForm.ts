import {
  CARD_TYPES,
  type Card,
  type CardCreate,
  type CardTypeId,
  canPromote,
  hasReveal,
  isLearnable,
  listTypeSlots,
  type SlotId,
} from "@vega/shared";
import { useEffect, useRef, useState } from "react";
import { todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";

const ARRAY_SLOTS: readonly SlotId[] = ["examples", "synonyms"];

export const isArraySlot = (slot: SlotId): boolean => ARRAY_SLOTS.includes(slot);

export interface CardFormValues {
  type: CardTypeId;
  category: string;
  slots: Record<SlotId, string>;
  hasRecall: boolean;
  learning: boolean;
}

const EMPTY_SLOTS: Record<SlotId, string> = {
  title: "",
  body: "",
  author: "",
  work: "",
  locator: "",
  phonetic: "",
  language: "",
  examples: "",
  synonyms: "",
};

const readSlots = (card: Card | null): Record<SlotId, string> => ({
  title: card?.title ?? "",
  body: card?.body ?? "",
  author: card?.author ?? "",
  work: card?.work ?? "",
  locator: card?.locator ?? "",
  phonetic: card?.phonetic ?? "",
  language: card?.language ?? "",
  // one item per line — slice 4's card page gives the arrays their own rows
  examples: (card?.examples ?? []).join("\n"),
  synonyms: (card?.synonyms ?? []).join("\n"),
});

const readForm = (card: Card | null): CardFormValues => ({
  type: card?.type ?? "note",
  category: card?.category ?? "",
  slots: card ? readSlots(card) : { ...EMPTY_SLOTS },
  hasRecall: card?.hasRecall ?? false,
  learning: card ? card.box !== null : false,
});

const toLines = (raw: string): string[] =>
  raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line !== "");

export function toCardFields(values: CardFormValues): Omit<CardCreate, "addedAt" | "reviewCount"> {
  const declared = CARD_TYPES[values.type].slots;
  const text = (slot: SlotId): string => (declared[slot] ? values.slots[slot].trim() : "");
  const list = (slot: SlotId): string[] => (declared[slot] ? toLines(values.slots[slot]) : []);
  return {
    type: values.type,
    category: values.category.trim(),
    title: text("title"),
    body: text("body"),
    author: text("author") || null,
    work: text("work") || null,
    locator: text("locator") || null,
    phonetic: text("phonetic") || null,
    language: text("language") || null,
    examples: list("examples"),
    synonyms: list("synonyms"),
    hasRecall: values.hasRecall,
    hiddenAt: null,
    likedAt: null,
    box: null,
    lastReviewed: null,
    nextDue: null,
  };
}

export function canSaveForm(values: CardFormValues): boolean {
  return listTypeSlots(values.type).every(([slot, def]) => {
    if (def.required !== true) return true;
    return isArraySlot(slot)
      ? toLines(values.slots[slot]).length > 0
      : values.slots[slot].trim() !== "";
  });
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
  const cards = useStore((s) => s.cards);
  const addCard = useStore((s) => s.addCard);
  const updateCard = useStore((s) => s.updateCard);
  const removeCard = useStore((s) => s.removeCard);
  const setCardLearning = useStore((s) => s.setCardLearning);
  const pushToast = useStore((s) => s.pushToast);

  const card = cardId ? (cards.find((c) => c.id === cardId) ?? null) : null;
  const isCreate = cardId === null;

  const [values, setValues] = useState<CardFormValues>(() => readForm(card));
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);
  const initialLearning = useRef(false);

  const openKey = isOpen ? (cardId ?? "new") : null;
  const prevKey = useRef<string | null>(null);
  if (prevKey.current !== openKey) {
    prevKey.current = openKey;
    if (isOpen) {
      const fresh = readForm(card);
      initialLearning.current = fresh.learning;
      setValues(fresh);
      setIsConfirmingDelete(false);
    }
  }

  const setSlot = (slot: SlotId, next: string) =>
    setValues((current) => ({ ...current, slots: { ...current.slots, [slot]: next } }));

  const setCategory = (category: string) => setValues((current) => ({ ...current, category }));

  const handleTypeChange = (type: CardTypeId) =>
    setValues((current) => {
      const next = { ...current, type, hasRecall: false };
      return { ...next, learning: isLearnable(next) ? current.learning : false };
    });

  const handleRecallToggle = () =>
    setValues((current) => {
      const next = { ...current, hasRecall: !current.hasRecall };
      return { ...next, learning: isLearnable(next) ? current.learning : false };
    });

  useEffect(() => {
    if (isOpen && cardId !== null && card === null) {
      pushToast("Card no longer exists");
      onClose();
    }
  }, [isOpen, cardId, card, onClose, pushToast]);

  const canSave = canSaveForm(values);

  const handleSave = () => {
    if (!canSave) return;
    const fields = toCardFields(values);
    if (isCreate) {
      const created = addCard({ ...fields, addedAt: todayISO(), reviewCount: 0 });
      if (values.learning) setCardLearning(created.id, true);
    } else if (cardId) {
      updateCard(cardId, fields);
      if (values.learning !== initialLearning.current) setCardLearning(cardId, values.learning);
    }
    onClose();
  };

  const handleDelete = () => {
    setIsConfirmingDelete(false);
    onClose();
    if (cardId) removeCard(cardId);
  };

  return {
    cards,
    card,
    isCreate,
    openKey,
    values,
    setSlot,
    setCategory,
    handleTypeChange,
    handleRecallToggle,
    canPromoteDraft: canPromote({ ...values, title: values.slots.title }),
    hasRevealDraft: hasReveal(values),
    isLearnableDraft: isLearnable(values),
    setLearning: (learning: boolean) => setValues((c) => ({ ...c, learning })),
    canSave,
    handleSave,
    handleDelete,
    isConfirmingDelete,
    setIsConfirmingDelete,
  };
}
