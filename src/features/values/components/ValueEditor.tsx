/**
 * Value editor — HeroUI centered Modal (vapor). Live per-field autosave through
 * `updateValue` (no Save button). If the target value is removed out from under
 * it (cascade), the editor detects the missing entity and closes (not-found state).
 */
import { Button, Modal, useOverlayState } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import type { IconName } from "@/core/lib/icon-names";
import { useStore } from "@/core/store";
import { cx, Icon, IconField, useCompactModal } from "@/core/ui";
import { VALUE_HUES, VALUE_PALETTE, valueColor } from "../color";
import type { Value } from "../model";
import { EditorField, HuePicker } from "./editor-bits";

interface ValueDraft {
  name: string;
  desc: string;
  icon: IconName;
  /** "" = auto (order-based color) until the user picks a swatch. */
  hue: string;
}

const BLANK: ValueDraft = { name: "", desc: "", icon: "compass", hue: "" };

export function ValueEditor({
  valueId,
  creating,
  onClose,
  onDelete,
}: {
  valueId: string | null;
  creating: boolean;
  onClose: () => void;
  onDelete: (value: Value) => void;
}) {
  const value = useStore((s) => s.values.find((v) => v.id === valueId)) ?? null;
  const update = useStore((s) => s.updateValue);
  const addValue = useStore((s) => s.addValue);

  const [draft, setDraft] = useState<ValueDraft>(BLANK);

  // Fresh draft each time the create flow opens — nothing is persisted until "Create".
  useEffect(() => {
    if (creating) setDraft(BLANK);
  }, [creating]);

  // Not-found: an editing target was removed (e.g. cascade) while open → close.
  useEffect(() => {
    if (valueId && !value) onClose();
  }, [valueId, value, onClose]);

  const isOpen = creating || !!value;
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isOpen && creating) nameRef.current?.focus();
  }, [isOpen, creating]);
  // Fields read from the live record when editing, or the local draft when creating.
  const view = value ?? draft;
  const color = value ? valueColor(value) : draft.hue || VALUE_PALETTE[0];

  const setField = (patch: Partial<ValueDraft>) => {
    if (value) update(value.id, patch);
    else setDraft((d) => ({ ...d, ...patch }));
  };

  const create = () => {
    const name = draft.name.trim();
    if (!name) return;
    addValue({ name, desc: draft.desc, icon: draft.icon, hue: draft.hue });
    onClose();
  };

  const responsive = useCompactModal();
  const state = useOverlayState({
    isOpen,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
  });
  return (
    <Modal state={state}>
      <Modal.Backdrop variant="blur">
        <Modal.Container {...responsive}>
          <Modal.Dialog aria-label={creating ? "New value" : "Edit value"}>
            {isOpen && (
              <>
                <Modal.Header className="flex items-center gap-3">
                  <IconField
                    value={view.icon}
                    onSelect={(icon) => setField({ icon })}
                    triggerClassName="rounded-full border border-transparent hover:border-foreground/30"
                    triggerStyle={{ background: color }}
                    iconClassName="text-white"
                  />
                  <Modal.Heading className="text-base font-semibold text-foreground">
                    {creating ? "New value" : "Value"}
                  </Modal.Heading>
                </Modal.Header>

                <Modal.Body className="space-y-5">
                  <label className="block space-y-1.5">
                    <span className="text-xs text-muted">Name</span>
                    <input
                      ref={nameRef}
                      type="text"
                      placeholder="New value"
                      value={view.name}
                      onChange={(e) => setField({ name: e.target.value })}
                      className={FIELD_CLASS}
                    />
                  </label>

                  <label className="block space-y-1.5">
                    <span className="text-xs text-muted">What it means to you</span>
                    <textarea
                      placeholder="A sentence on why this matters…"
                      value={view.desc}
                      onChange={(e) => setField({ desc: e.target.value })}
                      rows={3}
                      className={cx(FIELD_CLASS, "resize-y")}
                    />
                  </label>

                  <EditorField label="Marker hue">
                    <HuePicker
                      value={view.hue}
                      options={VALUE_HUES}
                      onSelect={(hue) => setField({ hue })}
                    />
                  </EditorField>
                </Modal.Body>

                {creating ? (
                  <Modal.Footer className="justify-end gap-2">
                    <Button size="sm" variant="ghost" onPress={onClose}>
                      Cancel
                    </Button>
                    <Button
                      size="sm"
                      variant="primary"
                      isDisabled={!draft.name.trim()}
                      onPress={create}
                    >
                      Create value
                    </Button>
                  </Modal.Footer>
                ) : (
                  value && (
                    <Modal.Footer className="justify-between">
                      <Button size="sm" variant="danger-soft" onPress={() => onDelete(value)}>
                        <Icon name="trash" size={14} />
                        Delete value
                      </Button>
                      <Button size="sm" variant="primary" onPress={onClose}>
                        Done
                      </Button>
                    </Modal.Footer>
                  )
                )}
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

const FIELD_CLASS =
  "w-full rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
