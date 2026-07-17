import {
  closestCenter,
  DndContext,
  type DragEndEvent,
  DragOverlay,
  type DragStartEvent,
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
import { type ReactNode, useState } from "react";
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
          isDragging && "opacity-40",
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
      className={cx(group.li, "relative", isDragging && "opacity-40")}
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
 *
 * The picked-up item renders in a portalled `DragOverlay` at its natural size,
 * so a tall variable-height row keeps its real height as a stable preview
 * instead of being squished toward the drop target; its in-place row dims to a
 * placeholder and siblings reflow to open the gap.
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
  const [activeId, setActiveId] = useState<string | null>(null);
  const activeItem =
    activeId === null ? null : (items.find((item) => getId(item) === activeId) ?? null);

  const handleStart = ({ active }: DragStartEvent) => setActiveId(String(active.id));
  const handleCancel = () => setActiveId(null);
  const handleEnd = ({ active, over }: DragEndEvent) => {
    setActiveId(null);
    if (over && active.id !== over.id) onReorder(String(active.id), String(over.id));
  };

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragStart={handleStart}
      onDragEnd={handleEnd}
      onDragCancel={handleCancel}
    >
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
      <DragOverlay>
        {activeItem === null ? null : (
          <div className="cursor-grabbing">{renderItem(activeItem)}</div>
        )}
      </DragOverlay>
    </DndContext>
  );
}
