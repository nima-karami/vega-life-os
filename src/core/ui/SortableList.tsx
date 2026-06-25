import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  KeyboardSensor,
  PointerSensor,
  TouchSensor,
  useSensor,
  useSensors,
} from "@dnd-kit/core";
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./icons";

// Two static group names so a nested list's handles don't reveal when an
// ancestor row is hovered (Tailwind group-hover matches any same-named ancestor).
const ROW_GROUP = {
  outer: { li: "group/row", reveal: "group-hover/row:opacity-100" },
  inner: { li: "group/rownest", reveal: "group-hover/rownest:opacity-100" },
} as const;

function SortableRow({
  id,
  label,
  nested,
  wholeRow,
  children,
}: {
  id: string;
  label: string;
  nested: boolean;
  wholeRow: boolean;
  children: ReactNode;
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    setActivatorNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });
  const group = nested ? ROW_GROUP.inner : ROW_GROUP.outer;
  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 1 : undefined,
  };

  // Whole-row drag: the row itself is the activator (grab cursor, no handle). For
  // editors where a left-edge handle would be clipped by a scroll container. A 6px
  // activation distance keeps clicks on the row's controls working; inline-edit
  // inputs stop pointer/key propagation so typing never starts a drag.
  if (wholeRow) {
    return (
      <li
        ref={setNodeRef}
        {...attributes}
        {...listeners}
        aria-label={label}
        style={style}
        className={cx(
          "relative cursor-grab touch-none active:cursor-grabbing",
          isDragging && "opacity-80",
        )}
      >
        {children}
      </li>
    );
  }

  return (
    <li
      ref={setNodeRef}
      style={style}
      className={cx(group.li, "relative", isDragging && "opacity-80")}
    >
      {/* Notion-style handle: just outside the row's left edge, revealed on hover/focus. */}
      <button
        type="button"
        ref={setActivatorNodeRef}
        {...attributes}
        {...listeners}
        aria-label={label}
        className={cx(
          "absolute right-full top-1/2 z-10 grid -translate-y-1/2 cursor-grab touch-none place-items-center pr-1.5 text-muted opacity-0 transition-opacity hover:text-muted focus-visible:opacity-100",
          group.reveal,
        )}
      >
        <Icon name="drag" size={16} />
      </button>
      {children}
    </li>
  );
}

/**
 * Accessible vertical sortable list (pointer + keyboard + screen-reader
 * announcements via @dnd-kit). Each row gets a drag handle positioned just
 * outside its left edge, hidden until the row is hovered or the handle is
 * focused — so reordering never clutters the resting UI and other controls in a
 * row stay clickable. `onReorder` receives the dragged id and the id it was
 * dropped on.
 */
export function SortableList<T>({
  items,
  getId,
  getLabel,
  onReorder,
  renderItem,
  className,
  nested = false,
  wholeRowDrag = false,
}: {
  items: T[];
  getId: (item: T) => string;
  getLabel: (item: T) => string;
  onReorder: (activeId: string, overId: string) => void;
  renderItem: (item: T) => ReactNode;
  className?: string;
  /** Set on a list rendered inside another sortable row, so hover reveal stays scoped to its own rows. */
  nested?: boolean;
  /** Drag the whole row (grab cursor, no left handle) — for modals/editors where a left-edge handle is clipped. */
  wholeRowDrag?: boolean;
}) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    // Press-and-hold on touch lets quick swipes scroll rather than drag (WCAG 2.5.7).
    useSensor(TouchSensor, { activationConstraint: { delay: 250, tolerance: 8 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const ids = items.map(getId);

  const handleEnd = ({ active, over }: DragEndEvent) => {
    if (over && active.id !== over.id) onReorder(String(active.id), String(over.id));
  };

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleEnd}>
      <SortableContext items={ids} strategy={verticalListSortingStrategy}>
        <ul className={className}>
          {items.map((item) => (
            <SortableRow
              key={getId(item)}
              id={getId(item)}
              label={`Reorder ${getLabel(item)}`}
              nested={nested}
              wholeRow={wholeRowDrag}
            >
              {renderItem(item)}
            </SortableRow>
          ))}
        </ul>
      </SortableContext>
    </DndContext>
  );
}
