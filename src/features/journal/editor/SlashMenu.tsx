import { Extension, type Range } from "@tiptap/core";
import type { Editor } from "@tiptap/react";
import { ReactRenderer } from "@tiptap/react";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import {
  ChevronRight,
  Code,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  ListTodo,
  type LucideIcon,
  Minus,
  Quote,
  Type,
} from "lucide-react";
import { forwardRef, useImperativeHandle, useState } from "react";

interface SlashCommand {
  title: string;
  hint: string;
  icon: LucideIcon;
  keywords: string[];
  run: (editor: Editor, range: Range) => void;
}

const COMMANDS: SlashCommand[] = [
  {
    title: "Text",
    hint: "Plain paragraph",
    icon: Type,
    keywords: ["paragraph", "text", "body"],
    run: (e, r) => e.chain().focus().deleteRange(r).setParagraph().run(),
  },
  {
    title: "Heading 1",
    hint: "Big section heading",
    icon: Heading1,
    keywords: ["h1", "title", "heading"],
    run: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 1 }).run(),
  },
  {
    title: "Heading 2",
    hint: "Medium heading",
    icon: Heading2,
    keywords: ["h2", "heading", "subtitle"],
    run: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 2 }).run(),
  },
  {
    title: "Heading 3",
    hint: "Small heading",
    icon: Heading3,
    keywords: ["h3", "heading"],
    run: (e, r) => e.chain().focus().deleteRange(r).setNode("heading", { level: 3 }).run(),
  },
  {
    title: "Bullet list",
    hint: "Unordered list",
    icon: List,
    keywords: ["bullet", "unordered", "list", "ul"],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBulletList().run(),
  },
  {
    title: "Numbered list",
    hint: "Ordered list",
    icon: ListOrdered,
    keywords: ["numbered", "ordered", "list", "ol"],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleOrderedList().run(),
  },
  {
    title: "To-do list",
    hint: "Checkbox list",
    icon: ListTodo,
    keywords: ["todo", "task", "checkbox", "check"],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleTaskList().run(),
  },
  {
    title: "Quote",
    hint: "Block quote",
    icon: Quote,
    keywords: ["quote", "blockquote", "cite"],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleBlockquote().run(),
  },
  {
    title: "Code block",
    hint: "Fenced code",
    icon: Code,
    keywords: ["code", "codeblock", "pre", "monospace"],
    run: (e, r) => e.chain().focus().deleteRange(r).toggleCodeBlock().run(),
  },
  {
    title: "Divider",
    hint: "Horizontal rule",
    icon: Minus,
    keywords: ["divider", "hr", "rule", "separator"],
    run: (e, r) => e.chain().focus().deleteRange(r).setHorizontalRule().run(),
  },
];

function filterCommands(query: string): SlashCommand[] {
  const q = query.trim().toLowerCase();
  if (q === "") return COMMANDS;
  return COMMANDS.filter(
    (c) => c.title.toLowerCase().includes(q) || c.keywords.some((k) => k.includes(q)),
  );
}

interface SlashListHandle {
  onKeyDown: (e: KeyboardEvent) => boolean;
}

interface SlashListProps extends SuggestionProps<SlashCommand> {
  items: SlashCommand[];
}

const SlashList = forwardRef<SlashListHandle, SlashListProps>((props, ref) => {
  const count = props.items.length;
  const [rawActive, setActive] = useState(0);
  // Clamp during render so the highlight stays valid as the filtered set shrinks.
  const active = count === 0 ? 0 : Math.min(rawActive, count - 1);

  const select = (index: number) => {
    const item = props.items[index];
    if (item) props.command(item);
  };

  useImperativeHandle(ref, () => ({
    onKeyDown: (e) => {
      if (count === 0) return false;
      if (e.key === "ArrowUp") {
        setActive((a) => (Math.min(a, count - 1) + count - 1) % count);
        return true;
      }
      if (e.key === "ArrowDown") {
        setActive((a) => (Math.min(a, count - 1) + 1) % count);
        return true;
      }
      if (e.key === "Enter") {
        select(active);
        return true;
      }
      return false;
    },
  }));

  if (props.items.length === 0) {
    return (
      <div className="w-60 rounded-medium border border-divider bg-content1 p-2 text-small text-default-500 shadow-medium">
        No matches
      </div>
    );
  }

  return (
    <div
      role="listbox"
      tabIndex={-1}
      aria-label="Insert block"
      aria-activedescendant={`slash-opt-${active}`}
      className="max-h-72 w-60 overflow-y-auto rounded-medium border border-divider bg-content1 p-1 shadow-medium outline-none"
    >
      {props.items.map((item, i) => {
        const ItemIcon = item.icon;
        const selected = i === active;
        return (
          <button
            key={item.title}
            type="button"
            id={`slash-opt-${i}`}
            role="option"
            aria-selected={selected}
            onMouseEnter={() => setActive(i)}
            onMouseDown={(e) => {
              e.preventDefault();
              select(i);
            }}
            className={`flex w-full items-center gap-2.5 rounded-small px-2 py-1.5 text-left outline-none ${
              selected ? "bg-primary/10 text-foreground" : "text-default-600"
            }`}
          >
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-small border border-divider bg-content2 text-default-500">
              <ItemIcon size={15} strokeWidth={1.75} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-small font-medium text-foreground">
                {item.title}
              </span>
              <span className="block truncate text-tiny text-default-400">{item.hint}</span>
            </span>
            {selected && <ChevronRight size={13} className="shrink-0 text-default-400" />}
          </button>
        );
      })}
    </div>
  );
});
SlashList.displayName = "SlashList";

/** Floating slash-command menu built on @tiptap/suggestion, rendered as a popover. */
export const SlashMenu = Extension.create({
  name: "journalSlashMenu",
  addProseMirrorPlugins() {
    return [
      Suggestion<SlashCommand>({
        editor: this.editor,
        char: "/",
        // Fire only at line start or after whitespace — never mid-word (so http:// is safe).
        allow: ({ state, range }) => {
          const $from = state.doc.resolve(range.from);
          const before = $from.nodeBefore;
          const charBefore = before?.isText ? (before.text?.slice(-1) ?? "") : "";
          return charBefore === "" || /\s/.test(charBefore);
        },
        command: ({ editor, range, props }) => props.run(editor, range),
        items: ({ query }) => filterCommands(query),
        render: () => {
          let renderer: ReactRenderer<SlashListHandle, SlashListProps>;
          let popup: HTMLDivElement;

          const reposition = (rect: (() => DOMRect | null) | null | undefined) => {
            const r = rect?.();
            if (!r) return;
            popup.style.top = `${r.bottom + 6 + window.scrollY}px`;
            popup.style.left = `${r.left + window.scrollX}px`;
          };

          return {
            onStart: (props) => {
              renderer = new ReactRenderer(SlashList, { props, editor: props.editor });
              popup = document.createElement("div");
              popup.style.position = "absolute";
              popup.style.zIndex = "60";
              popup.appendChild(renderer.element);
              document.body.appendChild(popup);
              reposition(props.clientRect);
            },
            onUpdate: (props) => {
              renderer.updateProps(props);
              reposition(props.clientRect);
            },
            onKeyDown: (props) => {
              if (props.event.key === "Escape") {
                popup.remove();
                renderer.destroy();
                return true;
              }
              return renderer.ref?.onKeyDown(props.event) ?? false;
            },
            onExit: () => {
              popup.remove();
              renderer.destroy();
            },
          };
        },
      }),
    ];
  },
});
