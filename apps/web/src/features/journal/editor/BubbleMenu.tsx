import type { Editor } from "@tiptap/react";
import { posToDOMRect } from "@tiptap/react";
import { Bold, Code, Italic, Link2, Link2Off, Strikethrough } from "lucide-react";
import { type FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { useCompact } from "@/core/ui";
import { isSafeHref } from "./extensions";

interface MarkButton {
  name: string;
  label: string;
  icon: typeof Bold;
  isActive: (e: Editor) => boolean;
  toggle: (e: Editor) => void;
}

const MARKS: MarkButton[] = [
  {
    name: "bold",
    label: "Bold",
    icon: Bold,
    isActive: (e) => e.isActive("bold"),
    toggle: (e) => e.chain().focus().toggleBold().run(),
  },
  {
    name: "italic",
    label: "Italic",
    icon: Italic,
    isActive: (e) => e.isActive("italic"),
    toggle: (e) => e.chain().focus().toggleItalic().run(),
  },
  {
    name: "strike",
    label: "Strikethrough",
    icon: Strikethrough,
    isActive: (e) => e.isActive("strike"),
    toggle: (e) => e.chain().focus().toggleStrike().run(),
  },
  {
    name: "code",
    label: "Inline code",
    icon: Code,
    isActive: (e) => e.isActive("code"),
    toggle: (e) => e.chain().focus().toggleCode().run(),
  },
];

/**
 * Selection format toolbar. Floats above the current text selection; offers the
 * inline marks and a link popover. Hidden when the selection is empty.
 */
export function JournalBubbleMenu({ editor }: { editor: Editor }) {
  const compact = useCompact();
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkValue, setLinkValue] = useState("");
  // bumped on every editor transaction so active-mark state re-renders the toolbar
  const [, setVersion] = useState(0);
  const linkInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const update = () => {
      const { state, view } = editor;
      const { from, to, empty } = state.selection;
      const isFocused = view.hasFocus();
      setVersion((v) => v + 1);
      if (empty || (!isFocused && !linkOpen)) {
        if (!linkOpen) setPos(null);
        return;
      }
      const rect = posToDOMRect(view, from, to);
      setPos({ top: rect.top + window.scrollY, left: rect.left + rect.width / 2 + window.scrollX });
    };
    editor.on("selectionUpdate", update);
    editor.on("transaction", update);
    editor.on("focus", update);
    editor.on("blur", update);
    return () => {
      editor.off("selectionUpdate", update);
      editor.off("transaction", update);
      editor.off("focus", update);
      editor.off("blur", update);
    };
  }, [editor, linkOpen]);

  const openLink = useCallback(() => {
    setLinkValue(editor.getAttributes("link").href ?? "");
    setLinkOpen(true);
    requestAnimationFrame(() => linkInputRef.current?.focus());
  }, [editor]);

  // Ctrl/Cmd-K opens the link popover for the current selection.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        if (editor.state.selection.empty || !editor.view.hasFocus()) return;
        e.preventDefault();
        openLink();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editor, openLink]);

  const applyLink = (ev: FormEvent) => {
    ev.preventDefault();
    const url = linkValue.trim();
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
    } else if (isSafeHref(url)) {
      editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
    }
    setLinkOpen(false);
  };

  if (!pos) return null;

  const isLinkActive = editor.isActive("link");

  // Compact: dock the toolbar to the bottom (above the keyboard) instead of
  // floating over the selection, where it's hidden by the caret/handles.
  const wrapperClass = compact
    ? "safe-mb fixed inset-x-0 bottom-0 z-50 flex justify-center px-3 pb-2"
    : "fixed z-50 -translate-x-1/2 -translate-y-full pb-2";
  const wrapperStyle = compact ? undefined : { top: pos.top, left: pos.left };

  return (
    <div className={wrapperClass} style={wrapperStyle}>
      {linkOpen ? (
        <form
          onSubmit={applyLink}
          className="flex items-center gap-1 rounded-[12px] border border-border bg-surface p-1 shadow-md"
        >
          <input
            ref={linkInputRef}
            value={linkValue}
            onChange={(e) => setLinkValue(e.target.value)}
            onKeyDown={(e) => e.key === "Escape" && setLinkOpen(false)}
            placeholder="https://…"
            aria-label="Link URL"
            className="h-8 w-52 rounded-[8px] bg-transparent px-2 text-sm text-foreground outline-none placeholder:text-muted"
          />
          <button
            type="submit"
            className="grid h-8 w-8 place-items-center rounded-[8px] text-accent hover:bg-accent/10"
            aria-label="Apply link"
          >
            <Link2 size={15} />
          </button>
          {isLinkActive && (
            <button
              type="button"
              onClick={() => {
                editor.chain().focus().extendMarkRange("link").unsetLink().run();
                setLinkOpen(false);
              }}
              className="grid h-8 w-8 place-items-center rounded-[8px] text-danger hover:bg-danger/10"
              aria-label="Remove link"
            >
              <Link2Off size={15} />
            </button>
          )}
        </form>
      ) : (
        <div
          role="toolbar"
          aria-label="Text formatting"
          className="flex items-center gap-0.5 rounded-[12px] border border-border bg-surface p-1 shadow-md"
        >
          {MARKS.map((m) => {
            const MarkIcon = m.icon;
            const isActive = m.isActive(editor);
            return (
              <button
                key={m.name}
                type="button"
                aria-label={m.label}
                aria-pressed={isActive}
                onMouseDown={(e) => {
                  e.preventDefault();
                  m.toggle(editor);
                }}
                className={`grid h-8 w-8 place-items-center rounded-[8px] ${
                  isActive
                    ? "bg-accent text-accent-foreground"
                    : "text-muted hover:bg-surface-secondary"
                }`}
              >
                <MarkIcon size={15} strokeWidth={2} />
              </button>
            );
          })}
          <span className="mx-0.5 h-5 w-px bg-divider" aria-hidden="true" />
          <button
            type="button"
            aria-label="Link"
            aria-pressed={isLinkActive}
            onMouseDown={(e) => {
              e.preventDefault();
              openLink();
            }}
            className={`grid h-8 w-8 place-items-center rounded-[8px] ${
              isLinkActive
                ? "bg-accent text-accent-foreground"
                : "text-muted hover:bg-surface-secondary"
            }`}
          >
            <Link2 size={15} strokeWidth={2} />
          </button>
        </div>
      )}
    </div>
  );
}
