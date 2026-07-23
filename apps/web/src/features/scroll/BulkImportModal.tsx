import { Button, Modal, useOverlayState } from "@heroui/react";
import { useMemo, useRef, useState } from "react";
import { useStore } from "@/core/store";
import { useCompactModal } from "@/core/ui";
import { CategoryField, FIELD_CLASS } from "./CategoryField";
import { parseBulkImport } from "./queries";

export function BulkImportModal({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const bulkAddMindCards = useStore((s) => s.bulkAddMindCards);
  const cards = useStore((s) => s.mindCards);
  const pushToast = useStore((s) => s.pushToast);

  const [text, setText] = useState("");
  const [category, setCategory] = useState("");

  const prevOpen = useRef(false);
  if (prevOpen.current !== isOpen) {
    prevOpen.current = isOpen;
    if (isOpen) {
      setText("");
      setCategory("");
    }
  }

  const parsed = useMemo(() => parseBulkImport(text), [text]);
  const previewLine = useMemo(() => {
    const count = parsed.cards.length;
    const label = category.trim() || "uncategorized";
    const parts = [`${count} card${count === 1 ? "" : "s"} → ${label}`];
    if (parsed.skipped) parts.push(`${parsed.skipped} skipped`);
    if (parsed.overLength) parts.push(`${parsed.overLength} too long`);
    return parts.join(" · ");
  }, [parsed, category]);

  const responsive = useCompactModal();
  const state = useOverlayState({
    isOpen,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
  });

  const handleImport = () => {
    const trimmedCategory = category.trim();
    bulkAddMindCards(
      parsed.cards.map(({ title, body }) => ({ title, body, category: trimmedCategory })),
    );
    pushToast(`Imported ${parsed.cards.length} card${parsed.cards.length === 1 ? "" : "s"}`);
    onClose();
  };

  return (
    <Modal state={state}>
      <Modal.Backdrop variant="blur">
        <Modal.Container {...responsive}>
          <Modal.Dialog aria-label="Bulk import cards">
            <Modal.Header>
              <Modal.Heading className="text-base font-semibold text-foreground">
                Bulk import
              </Modal.Heading>
            </Modal.Header>

            <Modal.Body className="space-y-5">
              <div className="space-y-2.5">
                <span className="text-xs text-muted">
                  One card per line. Use <code className="text-foreground">title :: body</code> to
                  add a body.
                </span>
                <textarea
                  aria-label="Bulk import"
                  placeholder={
                    "Anchor first in a negotiation\nName the emotion :: it loosens its grip"
                  }
                  value={text}
                  onChange={(event) => setText(event.target.value)}
                  rows={8}
                  className={`${FIELD_CLASS} resize-y`}
                />
              </div>

              <div className="space-y-2.5">
                <span className="text-xs text-muted">Category</span>
                <CategoryField value={category} onChange={setCategory} cards={cards} />
              </div>

              <p className="text-sm text-muted tabular-nums">{previewLine}</p>
            </Modal.Body>

            <Modal.Footer className="justify-end gap-2">
              <Button size="sm" variant="ghost" onPress={onClose}>
                Cancel
              </Button>
              <Button
                size="sm"
                variant="primary"
                isDisabled={parsed.cards.length === 0}
                onPress={handleImport}
              >
                Import
              </Button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
