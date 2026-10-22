import { FloatingMenu, type MenuItem } from "@/core/ui";

export interface SlotMenuState {
  x: number;
  y: number;
  date: string;
  time: string;
  scrim: boolean;
}

/** Right-click an empty slot: add, paste, or schedule an existing task there. */
export function SlotActionsMenu({
  menu,
  clipboardTitle,
  hasBacklog,
  onAdd,
  onPaste,
  onScheduleExisting,
  onClose,
}: {
  menu: SlotMenuState;
  clipboardTitle: string | undefined;
  hasBacklog: boolean;
  onAdd: () => void;
  onPaste: () => void;
  onScheduleExisting: () => void;
  onClose: () => void;
}) {
  const pasteItems: MenuItem[] =
    clipboardTitle === undefined
      ? []
      : [{ label: `Paste "${clipboardTitle}"`, icon: "clipboard", onSelect: onPaste }];
  return (
    <FloatingMenu
      pos={{ x: menu.x, y: menu.y }}
      onClose={onClose}
      label="Slot actions"
      dismissScrim={menu.scrim}
      items={[
        { label: "Add task here", icon: "plus", onSelect: onAdd },
        ...pasteItems,
        {
          label: "Schedule existing task…",
          icon: "calendar",
          disabled: !hasBacklog,
          onSelect: onScheduleExisting,
        },
      ]}
    />
  );
}
