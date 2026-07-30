import { Button, Modal, useOverlayState } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { uid } from "@/core/lib/id";
import { useStore } from "@/core/store";
import { ConfirmDialog, draftSafeBackdrop, Icon, useCompactModal } from "@/core/ui";
import { listVocabExamples, type VocabEntry } from "./model";

const FIELD_CLASS =
  "w-full rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

const MAX_EXAMPLES = 5;

interface ExampleRow {
  key: string;
  text: string;
}

interface VocabFormValues {
  term: string;
  phonetic: string;
  language: string;
  definition: string;
  examples: ExampleRow[];
  synonymsInput: string;
}

const buildExampleRows = (texts: string[]): ExampleRow[] => {
  const rows = texts.map((text) => ({ key: uid("ex_"), text }));
  return rows.length > 0 ? rows : [{ key: uid("ex_"), text: "" }];
};

function readVocabFields(entry: VocabEntry | null, prefillTerm: string): VocabFormValues {
  return {
    term: entry?.term ?? prefillTerm,
    phonetic: entry?.phonetic ?? "",
    language: entry?.language ?? "English",
    definition: entry?.definition ?? "",
    examples: buildExampleRows(entry ? listVocabExamples(entry) : []),
    synonymsInput: (entry?.synonyms ?? []).join(", "),
  };
}

const parseSynonyms = (input: string): string[] =>
  input
    .split(",")
    .map((synonym) => synonym.trim())
    .filter((synonym) => synonym !== "");

function useVocabEditorForm({
  entryId,
  prefillTerm,
  isOpen,
  onClose,
}: {
  entryId: string | null;
  prefillTerm: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const vocab = useStore((s) => s.vocab);
  const addVocab = useStore((s) => s.addVocab);
  const updateVocab = useStore((s) => s.updateVocab);
  const removeVocab = useStore((s) => s.removeVocab);
  const pushToast = useStore((s) => s.pushToast);

  const entry = entryId ? (vocab.find((word) => word.id === entryId) ?? null) : null;
  const isCreate = entryId === null;

  const [values, setValues] = useState<VocabFormValues>(() => readVocabFields(entry, prefillTerm));
  const [isConfirmingDelete, setIsConfirmingDelete] = useState(false);

  const openKey = isOpen ? (entryId ?? "new") : null;
  const prevKey = useRef<string | null>(null);
  if (prevKey.current !== openKey) {
    prevKey.current = openKey;
    if (isOpen) {
      setValues(readVocabFields(entry, prefillTerm));
      setIsConfirmingDelete(false);
    }
  }

  const setField = <K extends keyof VocabFormValues>(key: K, next: VocabFormValues[K]) =>
    setValues((current) => ({ ...current, [key]: next }));

  const handleExampleChange = (key: string, text: string) =>
    setValues((current) => ({
      ...current,
      examples: current.examples.map((row) => (row.key === key ? { ...row, text } : row)),
    }));

  const handleExampleAdd = () =>
    setValues((current) =>
      current.examples.length >= MAX_EXAMPLES
        ? current
        : { ...current, examples: [...current.examples, { key: uid("ex_"), text: "" }] },
    );

  const handleExampleRemove = (key: string) =>
    setValues((current) => ({
      ...current,
      examples: current.examples.filter((row) => row.key !== key),
    }));

  useEffect(() => {
    if (isOpen && entryId !== null && entry === null) {
      pushToast("Word no longer exists");
      onClose();
    }
  }, [isOpen, entryId, entry, onClose, pushToast]);

  const handleSave = () => {
    const term = values.term.trim();
    const definition = values.definition.trim();
    if (!term || !definition) return;
    const fields = {
      term,
      definition,
      phonetic: values.phonetic.trim(),
      language: values.language.trim() || "English",
      examples: values.examples.map((row) => row.text.trim()).filter((text) => text !== ""),
      synonyms: parseSynonyms(values.synonymsInput),
    };
    try {
      if (isCreate) addVocab(fields);
      else if (entryId) updateVocab(entryId, fields);
      onClose();
    } catch {
      pushToast("Couldn't save — try again");
    }
  };

  const handleDelete = () => {
    setIsConfirmingDelete(false);
    onClose();
    if (entryId) removeVocab(entryId);
  };

  return {
    isCreate,
    values,
    setField,
    handleExampleChange,
    handleExampleAdd,
    handleExampleRemove,
    handleSave,
    handleDelete,
    isConfirmingDelete,
    setIsConfirmingDelete,
  };
}

export function VocabEditorModal({
  entryId,
  prefillTerm,
  isOpen,
  onClose,
}: {
  entryId: string | null;
  prefillTerm: string;
  isOpen: boolean;
  onClose: () => void;
}) {
  const {
    isCreate,
    values,
    setField,
    handleExampleChange,
    handleExampleAdd,
    handleExampleRemove,
    handleSave,
    handleDelete,
    isConfirmingDelete,
    setIsConfirmingDelete,
  } = useVocabEditorForm({ entryId, prefillTerm, isOpen, onClose });

  const termRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isOpen && isCreate) termRef.current?.focus();
  }, [isOpen, isCreate]);

  const responsive = useCompactModal();
  const state = useOverlayState({
    isOpen,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
  });

  const canSave = values.term.trim().length > 0 && values.definition.trim().length > 0;
  const heading = isCreate ? "New word" : "Edit word";

  return (
    <>
      <Modal state={state}>
        <Modal.Backdrop variant="blur" {...draftSafeBackdrop}>
          <Modal.Container {...responsive}>
            <Modal.Dialog aria-label={heading}>
              <Modal.Header>
                <Modal.Heading className="text-base font-semibold text-foreground">
                  {heading}
                </Modal.Heading>
              </Modal.Header>

              <Modal.Body className="space-y-5">
                <label className="block space-y-2.5">
                  <span className="text-xs text-muted">Term</span>
                  <input
                    ref={termRef}
                    type="text"
                    aria-label="Term"
                    placeholder="The word itself"
                    value={values.term}
                    onChange={(event) => setField("term", event.target.value)}
                    className={FIELD_CLASS}
                  />
                </label>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block space-y-2.5">
                    <span className="text-xs text-muted">Phonetic</span>
                    <input
                      type="text"
                      aria-label="Phonetic"
                      placeholder="/daɪˈɡrɛʃ(ə)n/"
                      value={values.phonetic}
                      onChange={(event) => setField("phonetic", event.target.value)}
                      className={FIELD_CLASS}
                    />
                  </label>
                  <label className="block space-y-2.5">
                    <span className="text-xs text-muted">Language</span>
                    <input
                      type="text"
                      aria-label="Language"
                      placeholder="English"
                      value={values.language}
                      onChange={(event) => setField("language", event.target.value)}
                      className={FIELD_CLASS}
                    />
                  </label>
                </div>

                <label className="block space-y-2.5">
                  <span className="text-xs text-muted">Definition</span>
                  <textarea
                    aria-label="Definition"
                    placeholder="What the word means"
                    rows={3}
                    value={values.definition}
                    onChange={(event) => setField("definition", event.target.value)}
                    className={FIELD_CLASS}
                  />
                </label>

                <div className="space-y-2.5">
                  <span className="text-xs text-muted">Examples</span>
                  <div className="space-y-2">
                    {values.examples.map((row, index) => (
                      <div key={row.key} className="flex items-center gap-2">
                        <input
                          type="text"
                          aria-label={`Example ${index + 1}`}
                          placeholder="A sentence using the word"
                          value={row.text}
                          onChange={(event) => handleExampleChange(row.key, event.target.value)}
                          className={FIELD_CLASS}
                        />
                        {values.examples.length > 1 && (
                          <button
                            type="button"
                            aria-label={`Remove example ${index + 1}`}
                            onClick={() => handleExampleRemove(row.key)}
                            className="rounded p-1.5 text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
                          >
                            <Icon name="close" size={14} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                  {values.examples.length < MAX_EXAMPLES && (
                    <Button size="sm" variant="ghost" onPress={handleExampleAdd}>
                      <Icon name="plus" size={14} />
                      Add example
                    </Button>
                  )}
                </div>

                <label className="block space-y-2.5">
                  <span className="text-xs text-muted">Synonyms</span>
                  <input
                    type="text"
                    aria-label="Synonyms"
                    placeholder="tangent, detour, quirk"
                    value={values.synonymsInput}
                    onChange={(event) => setField("synonymsInput", event.target.value)}
                    className={FIELD_CLASS}
                  />
                </label>

                {!canSave && (
                  <p className="text-xs text-muted">A term and a definition are required.</p>
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
        title="Delete word?"
        body="This removes the word and its review history for good."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onClose={() => setIsConfirmingDelete(false)}
      />
    </>
  );
}
