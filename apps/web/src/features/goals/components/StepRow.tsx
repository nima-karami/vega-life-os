import { Checkbox } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { cx, FIELD_CLASS, Icon } from "@/core/ui";
import type { Subgoal } from "../model";

/** A goal step: done toggle, click-to-rename name, remove. (Reorder handle is owned by SortableList.) */
export function StepRow({
  sub,
  onToggle,
  onRemove,
  onRename,
}: {
  sub: Subgoal;
  onToggle: () => void;
  onRemove: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(sub.name);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const trimmed = text.trim();
    if (trimmed && trimmed !== sub.name) onRename(trimmed);
    else setText(sub.name);
  };

  return (
    <div className="group flex items-center gap-1.5">
      <Checkbox isSelected={sub.done} onChange={onToggle} aria-label={sub.name}>
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator>
              <Icon name="check" size={11} />
            </Checkbox.Indicator>
          </Checkbox.Control>
        </Checkbox.Content>
      </Checkbox>
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          // stop the row's whole-row drag from claiming text selection / the space key
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              setText(sub.name);
              setEditing(false);
            }
          }}
          aria-label={`Edit ${sub.name}`}
          className={cx(FIELD_CLASS, "flex-1")}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setText(sub.name);
            setEditing(true);
          }}
          className={cx(
            "flex-1 text-left text-sm",
            sub.done ? "text-muted line-through" : "text-foreground",
          )}
        >
          {sub.name}
        </button>
      )}
      <button
        type="button"
        aria-label={`Remove ${sub.name}`}
        onClick={onRemove}
        className="text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}
