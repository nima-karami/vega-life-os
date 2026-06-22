/**
 * Value editor — HeroUI centered Modal (vapor). Live per-field autosave through
 * `updateValue` (no Save button). If the target value is removed out from under
 * it (cascade), the editor detects the missing entity and closes (not-found state).
 */
import {
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
} from "@heroui/react";
import { useEffect } from "react";
import type { IconName } from "@/core/lib/icon-names";
import { useStore } from "@/core/store";
import { Button, Icon } from "@/core/ui";
import { valueColor } from "../color";
import type { Value } from "../model";
import { EditorField, FractionSlider, HuePicker, IconPicker } from "./editor-bits";

const VALUE_ICONS: IconName[] = [
  "compass",
  "heart",
  "shield",
  "eye",
  "target",
  "briefcase",
  "book",
  "spark",
  "flame",
  "sun",
  "moon",
  "orbit",
  "languages",
  "repeat",
  "chart",
  "globe",
];

/** Vapor marker hues offered in the editor (preset swatches only — no free hex). */
const HUES = [
  "#3B82C4",
  "#2F9E74",
  "#C2622E",
  "#8A4FC9",
  "#0E8C8C",
  "#B14A7A",
  "#6b7280",
  "#0d1117",
] as const;

export function ValueEditor({
  valueId,
  onClose,
  onDelete,
}: {
  valueId: string | null;
  onClose: () => void;
  onDelete: (value: Value) => void;
}) {
  const value = useStore((s) => s.values.find((v) => v.id === valueId)) ?? null;
  const update = useStore((s) => s.updateValue);

  // Not-found: the editor target was removed (e.g. cascade) while open → close.
  useEffect(() => {
    if (valueId && !value) onClose();
  }, [valueId, value, onClose]);

  const isOpen = !!value;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      placement="center"
      scrollBehavior="inside"
      backdrop="blur"
      aria-label="Edit value"
    >
      <ModalContent className="bg-[var(--color-surface)]">
        {value && (
          <>
            <ModalHeader className="flex items-center gap-3">
              <span
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full"
                style={{ background: valueColor(value) }}
              >
                <Icon name={value.icon} size={20} className="text-white" />
              </span>
              <span className="font-display text-lg">Value</span>
            </ModalHeader>

            <ModalBody className="space-y-5">
              <Input
                label="Name"
                labelPlacement="outside"
                placeholder="New value"
                value={value.name}
                onValueChange={(name) => update(value.id, { name })}
                variant="bordered"
              />

              <Textarea
                label="What it means to you"
                labelPlacement="outside"
                placeholder="A sentence on why this matters…"
                value={value.desc}
                onValueChange={(desc) => update(value.id, { desc })}
                variant="bordered"
                minRows={3}
              />

              <FractionSlider
                label="Energy this week"
                value={value.energy}
                onChange={(energy) => update(value.id, { energy })}
              />

              <EditorField label="Icon">
                <IconPicker
                  value={value.icon}
                  options={VALUE_ICONS}
                  onSelect={(icon) => update(value.id, { icon })}
                />
              </EditorField>

              <EditorField label="Marker hue">
                <HuePicker
                  value={value.hue}
                  options={HUES}
                  onSelect={(hue) => update(value.id, { hue })}
                />
              </EditorField>
            </ModalBody>

            <ModalFooter className="justify-between">
              <Button
                onClick={() => onDelete(value)}
                className="flex items-center gap-1.5 text-[var(--color-muted)] hover:text-[var(--color-accent)]"
              >
                <Icon name="trash" size={14} /> Delete value
              </Button>
              <Button solid onClick={onClose}>
                Done
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
