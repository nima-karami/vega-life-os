import { type PointerEvent, useRef, useState } from "react";
import { cx } from "@/core/ui";
import type { Value } from "@/features/values/model";
import { useValueColor } from "@/features/values/useValueColor";
import { positionFor, RING_COUNT, ratingFromDistance, type TargetPoint } from "./bullseye-geometry";
import { CHECK_IN_LABELS, type ReviewCheckIn } from "./model";
import { setCheckIn } from "./review-form";

const VIEW_HALF = 110;
const TARGET_RADIUS = 100;
const DOT_RADIUS = 7;
const DRAG_SLOP_PX = 4;
const RING_RATINGS = Array.from({ length: RING_COUNT }, (_, i) => i + 1);

interface DragState {
  valueId: string;
  pointerId: number;
  startX: number;
  startY: number;
  point: TargetPoint | null;
}

function toTargetPoint(clientX: number, clientY: number, rect: DOMRect): TargetPoint {
  return {
    x: ((clientX - rect.left) / rect.width) * 2 * VIEW_HALF - VIEW_HALF,
    y: ((clientY - rect.top) / rect.height) * 2 * VIEW_HALF - VIEW_HALF,
  };
}

const ratingAt = (point: TargetPoint) =>
  ratingFromDistance(Math.hypot(point.x, point.y), TARGET_RADIUS);

type DragHandlers = {
  onPointerDown: (event: PointerEvent<Element>) => void;
  onPointerMove: (event: PointerEvent<Element>) => void;
  onPointerUp: (event: PointerEvent<Element>) => void;
  onPointerCancel: () => void;
  onClick: () => void;
};

function TargetDot({
  valueId,
  point,
  isSelected,
  isDragging,
  handlers,
}: {
  valueId: string;
  point: TargetPoint;
  isSelected: boolean;
  isDragging: boolean;
  handlers: DragHandlers;
}) {
  const color = useValueColor(valueId);
  const radius = isDragging || isSelected ? DOT_RADIUS + 2 : DOT_RADIUS;
  return (
    <g className="cursor-grab" {...handlers}>
      {isSelected && (
        <circle cx={point.x} cy={point.y} r={radius + 3} className="fill-none stroke-accent" />
      )}
      <circle
        cx={point.x}
        cy={point.y}
        r={radius}
        fill={color}
        strokeWidth={2}
        className="stroke-surface"
      />
    </g>
  );
}

function TrayChip({
  value,
  isSelected,
  isDragging,
  handlers,
}: {
  value: Value;
  isSelected: boolean;
  isDragging: boolean;
  handlers: DragHandlers;
}) {
  const color = useValueColor(value.id);
  return (
    <button
      type="button"
      aria-pressed={isSelected}
      className={cx(
        "flex min-h-9 max-w-full touch-none select-none items-center gap-1.5 rounded-full border bg-surface px-3 text-sm text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent",
        isSelected ? "border-accent" : "border-border",
        isDragging && "opacity-40",
      )}
      {...handlers}
    >
      <span aria-hidden className="h-2 w-2 shrink-0 rounded-full" style={{ background: color }} />
      <span className="truncate">{value.name}</span>
    </button>
  );
}

export function ValueBullseye({
  values,
  checkIns,
  onChange,
}: {
  values: Value[];
  checkIns: ReviewCheckIn[];
  onChange: (next: ReviewCheckIn[]) => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const didDragRef = useRef(false);
  const [drag, setDrag] = useState<DragState | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const ratingOf = (valueId: string) => checkIns.find((c) => c.valueId === valueId)?.rating;
  const pointFrom = (clientX: number, clientY: number) => {
    const rect = svgRef.current?.getBoundingClientRect();
    return rect ? toTargetPoint(clientX, clientY, rect) : null;
  };
  const placeAt = (valueId: string, point: TargetPoint) => {
    onChange(setCheckIn(checkIns, valueId, ratingAt(point)));
    setSelectedId(null);
  };

  const handlersFor = (valueId: string): DragHandlers => ({
    onPointerDown: (event) => {
      if (event.button !== 0) return;
      event.currentTarget.setPointerCapture(event.pointerId);
      didDragRef.current = false;
      setDrag({
        valueId,
        pointerId: event.pointerId,
        startX: event.clientX,
        startY: event.clientY,
        point: null,
      });
    },
    onPointerMove: (event) => {
      if (drag?.pointerId !== event.pointerId) return;
      const travel = Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY);
      if (drag.point == null && travel < DRAG_SLOP_PX) return;
      const point = pointFrom(event.clientX, event.clientY);
      if (point) setDrag({ ...drag, point });
    },
    onPointerUp: (event) => {
      event.stopPropagation();
      if (drag?.pointerId !== event.pointerId) return;
      if (drag.point) {
        didDragRef.current = true;
        placeAt(drag.valueId, pointFrom(event.clientX, event.clientY) ?? drag.point);
      }
      setDrag(null);
    },
    onPointerCancel: () => setDrag(null),
    onClick: () => {
      if (didDragRef.current) {
        didDragRef.current = false;
        return;
      }
      setSelectedId((current) => (current === valueId ? null : valueId));
    },
  });

  const handleTargetTap = (event: PointerEvent<SVGSVGElement>) => {
    if (event.button !== 0 || !event.isPrimary || selectedId == null) return;
    const point = pointFrom(event.clientX, event.clientY);
    if (point) placeAt(selectedId, point);
  };

  const hoveredRating = drag?.point ? ratingAt(drag.point) : null;
  const unplaced = values.filter((v) => ratingOf(v.id) == null);
  const selectedName = values.find((v) => v.id === selectedId)?.name;

  const dotPoint = (value: Value, index: number): TargetPoint | null => {
    if (drag?.valueId === value.id && drag.point) return drag.point;
    const rating = ratingOf(value.id);
    if (rating == null) return null;
    const unit = positionFor(rating, index, values.length);
    return { x: unit.x * TARGET_RADIUS, y: unit.y * TARGET_RADIUS };
  };

  return (
    <div className="flex flex-col gap-3">
      <div className="-mx-3.5 sm:mx-auto sm:w-full sm:max-w-[320px]">
        <svg
          ref={svgRef}
          viewBox={`${-VIEW_HALF} ${-VIEW_HALF} ${VIEW_HALF * 2} ${VIEW_HALF * 2}`}
          role="img"
          aria-label="Value target"
          className={cx(
            "block aspect-square w-full touch-none select-none overflow-visible",
            selectedId != null && "cursor-pointer",
          )}
          onPointerUp={handleTargetTap}
        >
          {RING_RATINGS.map((rating) => (
            <circle
              key={rating}
              r={(TARGET_RADIUS * (RING_COUNT - rating + 1)) / RING_COUNT}
              className={cx(
                "stroke-border",
                hoveredRating === rating
                  ? "fill-accent/20"
                  : rating % 2 === 1
                    ? "fill-surface-secondary"
                    : "fill-surface",
              )}
            />
          ))}
          {values.map((value, index) => {
            const point = dotPoint(value, index);
            return (
              point && (
                <TargetDot
                  key={value.id}
                  valueId={value.id}
                  point={point}
                  isSelected={selectedId === value.id}
                  isDragging={drag?.valueId === value.id && drag.point != null}
                  handlers={handlersFor(value.id)}
                />
              )
            );
          })}
        </svg>
      </div>
      <p className="text-center text-[11px] text-muted">
        Centre: {CHECK_IN_LABELS[RING_COUNT - 1]} · Outer ring: {CHECK_IN_LABELS[0]}
      </p>
      {unplaced.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs text-muted" aria-live="polite">
            {selectedName
              ? `Tap a ring to place ${selectedName}.`
              : "Drag a value onto the target, or tap it and then a ring."}
          </p>
          <fieldset aria-label="Not yet placed" className="flex min-w-0 flex-wrap gap-2">
            {unplaced.map((value) => (
              <TrayChip
                key={value.id}
                value={value}
                isSelected={selectedId === value.id}
                isDragging={drag?.valueId === value.id && drag.point != null}
                handlers={handlersFor(value.id)}
              />
            ))}
          </fieldset>
        </div>
      )}
      {unplaced.length === 0 && selectedName && (
        <p className="text-xs text-muted" aria-live="polite">
          Tap a ring to move {selectedName}, or outside the rings to clear it.
        </p>
      )}
    </div>
  );
}
