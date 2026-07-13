import { ScrollShadow } from "@heroui/react";
import type { CSSProperties } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { IconName } from "@/core/lib/icon-names";
import { cx } from "./cx";
import { type CatalogEntry, filterCatalog, getGroupedCatalog } from "./icon-catalog";
import { Icon } from "./icons";
import { Popover } from "./popover";

const GRID_COLS = 6;

export interface IconFieldProps {
  value: IconName;
  onSelect: (icon: IconName) => void;
  label?: string;
  isDisabled?: boolean;
  /** Extra classes on the trigger badge (shape/colour). */
  triggerClassName?: string;
  /** Inline styles on the trigger badge (e.g. a value's hue background). */
  triggerStyle?: CSSProperties;
  /** Classes on the glyph itself (e.g. text-white over a coloured badge). */
  iconClassName?: string;
  iconSize?: number;
}

// Structural only (no shape/border) so a caller's triggerClassName can own those
// without clsx leaving two conflicting utilities in the class list.
const TRIGGER_BASE =
  "grid h-9 w-9 shrink-0 place-items-center outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface";
const TRIGGER_DEFAULT = "rounded-[12px] border border-border text-foreground hover:border-accent";

/**
 * Notion-style icon picker: a small trigger that opens a popover with a search box +
 * grouped/searchable grid, so it never resizes the surrounding dialog. Roving-tabindex
 * grid; the Popover handles outside-click/Escape/focus return.
 */
export function IconField({
  value,
  onSelect,
  label = "Icon",
  isDisabled,
  triggerClassName,
  triggerStyle,
  iconClassName,
  iconSize = 18,
}: IconFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [liveMsg, setLiveMsg] = useState("");

  const searchRef = useRef<HTMLInputElement>(null);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);

  const searching = query.trim().length > 0;

  const groups = useMemo(() => getGroupedCatalog(), []);
  const results = useMemo(() => filterCatalog(query), [query]);
  const pinned: CatalogEntry | null = useMemo(
    () => (searching ? null : { name: value, category: "Focus & goals", keywords: "" }),
    [searching, value],
  );
  const flatNames = useMemo<IconName[]>(() => {
    if (searching) return results.map((e) => e.name);
    const names = pinned ? [pinned.name] : [];
    for (const g of groups) for (const e of g.entries) names.push(e.name);
    return names;
  }, [searching, results, groups, pinned]);

  // Reset transient state whenever the popover closes.
  useEffect(() => {
    if (!open) {
      setQuery("");
      setActive(0);
    }
  }, [open]);

  // Keep the active index in range as the result set changes.
  useEffect(() => {
    setActive((i) => Math.min(i, Math.max(0, flatNames.length - 1)));
  }, [flatNames.length]);

  // Auto-focus search on open. Retry next frame in case the popover content
  // isn't mounted yet.
  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const pick = (icon: IconName) => {
    setLiveMsg(`Selected ${icon}`);
    onSelect(icon);
    setOpen(false);
  };

  const focusCell = (i: number) => {
    setActive(i);
    cellRefs.current[i]?.focus();
  };

  const onGridKeyDown = (e: React.KeyboardEvent) => {
    const n = flatNames.length;
    if (n === 0) return;
    let next = active;
    switch (e.key) {
      case "ArrowRight":
        next = Math.min(active + 1, n - 1);
        break;
      case "ArrowLeft":
        next = Math.max(active - 1, 0);
        break;
      case "ArrowDown":
        next = Math.min(active + GRID_COLS, n - 1);
        break;
      case "ArrowUp":
        next = Math.max(active - GRID_COLS, 0);
        break;
      case "Home":
        next = 0;
        break;
      case "End":
        next = n - 1;
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        pick(flatNames[active]);
        return;
      default:
        return;
    }
    e.preventDefault();
    focusCell(next);
  };

  // Two-step Esc: clear a non-empty query first (keep the popover open), else let
  // it bubble so the Popover closes and returns focus to the trigger.
  const onSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && searching) {
      e.preventDefault();
      e.stopPropagation();
      setQuery("");
      searchRef.current?.focus();
      return;
    }
    if (e.key === "ArrowDown" && flatNames.length > 0) {
      e.preventDefault();
      focusCell(active);
    }
  };

  if (isDisabled) {
    return (
      <span
        role="img"
        aria-label={`${label}: ${value}`}
        className={cx(TRIGGER_BASE, triggerClassName ?? TRIGGER_DEFAULT, "opacity-50")}
        style={triggerStyle}
      >
        <Icon name={value} size={iconSize} className={iconClassName} />
      </span>
    );
  }

  return (
    <>
      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {liveMsg}
      </p>
      <Popover
        open={open}
        onOpenChange={setOpen}
        align="start"
        triggerLabel={`${label}: ${value} — change`}
        triggerClassName={cx(TRIGGER_BASE, triggerClassName ?? TRIGGER_DEFAULT)}
        triggerStyle={triggerStyle}
        triggerContent={<Icon name={value} size={iconSize} className={iconClassName} />}
      >
        <div className="w-[340px] max-w-[calc(100vw-2rem)] p-3">
          <div className="relative">
            <Icon
              name="search"
              size={14}
              className="-translate-y-1/2 pointer-events-none absolute top-1/2 left-3 text-muted"
            />
            <input
              ref={searchRef}
              type="text"
              aria-label="Search icons"
              placeholder="Search icons…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
              className="w-full rounded-[10px] border border-border bg-surface py-2 pr-3 pl-9 text-sm text-foreground outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>

          <p aria-live="polite" className="sr-only">
            {searching ? `${results.length} ${results.length === 1 ? "icon" : "icons"}` : ""}
          </p>

          <ScrollShadow size={20} className="mt-3 max-h-72 overscroll-contain p-1.5">
            {searching ? (
              results.length === 0 ? (
                <p className="px-1 py-6 text-center text-xs text-muted">
                  No icons match “{query.trim()}”
                </p>
              ) : (
                <IconGrid
                  label={`Search results for ${query.trim()}`}
                  names={results.map((e) => e.name)}
                  value={value}
                  active={active}
                  offset={0}
                  cellRefs={cellRefs}
                  onPick={pick}
                  onKeyDown={onGridKeyDown}
                  onFocusCell={setActive}
                />
              )
            ) : (
              <div className="space-y-4">
                {pinned && (
                  <Section label="Current">
                    <IconGrid
                      label="Current"
                      names={[pinned.name]}
                      value={value}
                      active={active}
                      offset={0}
                      cellRefs={cellRefs}
                      onPick={pick}
                      onKeyDown={onGridKeyDown}
                      onFocusCell={setActive}
                    />
                  </Section>
                )}
                {groups.map((g, gi) => {
                  const start = (pinned ? 1 : 0) + offsetBefore(groups, gi);
                  return (
                    <Section key={g.category} label={g.category}>
                      <IconGrid
                        label={g.category}
                        names={g.entries.map((e) => e.name)}
                        value={value}
                        active={active}
                        offset={start}
                        cellRefs={cellRefs}
                        onPick={pick}
                        onKeyDown={onGridKeyDown}
                        onFocusCell={setActive}
                      />
                    </Section>
                  );
                })}
              </div>
            )}
          </ScrollShadow>
        </div>
      </Popover>
    </>
  );
}

function offsetBefore(groups: ReturnType<typeof getGroupedCatalog>, index: number): number {
  let n = 0;
  for (let i = 0; i < index; i++) n += groups[i].entries.length;
  return n;
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <p className="text-xs text-muted">{label}</p>
      {children}
    </div>
  );
}

function IconGrid({
  label,
  names,
  value,
  active,
  offset,
  cellRefs,
  onPick,
  onKeyDown,
  onFocusCell,
}: {
  label: string;
  names: IconName[];
  value: IconName;
  active: number;
  offset: number;
  cellRefs: React.MutableRefObject<(HTMLButtonElement | null)[]>;
  onPick: (icon: IconName) => void;
  onKeyDown: (e: React.KeyboardEvent) => void;
  onFocusCell: (i: number) => void;
}) {
  return (
    <fieldset aria-label={label} className="grid grid-cols-6 gap-2" onKeyDown={onKeyDown}>
      {names.map((name, i) => {
        const flatIndex = offset + i;
        const selected = name === value;
        const isRoving = flatIndex === active;
        return (
          <button
            key={`${label}:${name}`}
            ref={(el) => {
              cellRefs.current[flatIndex] = el;
            }}
            type="button"
            aria-pressed={selected}
            aria-label={name}
            tabIndex={isRoving ? 0 : -1}
            onFocus={() => onFocusCell(flatIndex)}
            onClick={() => onPick(name)}
            className={cx(
              "grid aspect-square min-h-[2.5rem] place-items-center rounded-[10px] border transition-colors",
              "outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-1 focus-visible:ring-offset-surface",
              selected
                ? "border-accent bg-accent text-accent-foreground ring-2 ring-accent ring-offset-1 ring-offset-surface"
                : "border-border text-muted hover:border-accent",
            )}
          >
            <Icon name={name} size={18} />
          </button>
        );
      })}
    </fieldset>
  );
}
