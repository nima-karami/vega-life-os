/**
 * Value editor — HeroUI centered Modal (vapor). Live per-field autosave through
 * `updateValue` (no Save button). If the target value is removed out from under
 * it (cascade), the editor detects the missing entity and closes (not-found state).
 */
import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
} from "@heroui/react";
import { useEffect, useState } from "react";
import type { IconName } from "@/core/lib/icon-names";
import { useStore } from "@/core/store";
import { Icon, IconField, useCompactModal } from "@/core/ui";
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
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      backdrop="blur"
      aria-label={creating ? "New value" : "Edit value"}
      {...responsive}
    >
      <ModalContent>
        {isOpen && (
          <>
            <ModalHeader className="flex items-center gap-3">
              <span
                className="grid h-9 w-9 shrink-0 place-items-center rounded-full"
                style={{ background: color }}
              >
                <Icon name={view.icon} size={18} className="text-white" />
              </span>
              <span className="text-medium font-semibold text-foreground">
                {creating ? "New value" : "Value"}
              </span>
            </ModalHeader>

            <ModalBody className="space-y-5">
              <Input
                label="Name"
                labelPlacement="outside"
                placeholder="New value"
                value={view.name}
                onValueChange={(name) => setField({ name })}
                variant="bordered"
                autoFocus={creating}
              />

              <Textarea
                label="What it means to you"
                labelPlacement="outside"
                placeholder="A sentence on why this matters…"
                value={view.desc}
                onValueChange={(desc) => setField({ desc })}
                variant="bordered"
                minRows={3}
              />

              <EditorField label="Icon">
                <IconField value={view.icon} onSelect={(icon) => setField({ icon })} />
              </EditorField>

              <EditorField label="Marker hue">
                <HuePicker
                  value={view.hue}
                  options={VALUE_HUES}
                  onSelect={(hue) => setField({ hue })}
                />
              </EditorField>
            </ModalBody>

            {creating ? (
              <ModalFooter className="justify-end gap-2">
                <Button size="sm" variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button size="sm" color="primary" isDisabled={!draft.name.trim()} onPress={create}>
                  Create value
                </Button>
              </ModalFooter>
            ) : (
              value && (
                <ModalFooter className="justify-between">
                  <Button
                    size="sm"
                    variant="light"
                    color="danger"
                    startContent={<Icon name="trash" size={14} />}
                    onPress={() => onDelete(value)}
                  >
                    Delete value
                  </Button>
                  <Button size="sm" color="primary" onPress={onClose}>
                    Done
                  </Button>
                </ModalFooter>
              )
            )}
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
