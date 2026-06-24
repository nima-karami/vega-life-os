import { Button } from "@heroui/react";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { IconName } from "@/core/lib/icon-names";
import { cx } from "./cx";
import { type CatalogEntry, filterCatalog, groupedCatalog } from "./icon-catalog";
import { Icon } from "./icons";

const GRID_COLS = 8;

export interface IconFieldProps {
  value: IconName;
  onSelect: (icon: IconName) => void;
  label?: string;
  isDisabled?: boolean;
}

/**
 * Shared icon picker: a trigger button that expands an inline, fixed-height,
 * inner-scroll panel. Idle = catalog grouped by category with the current
 * selection pinned; searching = a flat filtered grid. Single tab stop into the
 * grid (roving tabindex); never a focus trap.
 */
export function IconField({ value, onSelect, label = "Icon", isDisabled }: IconFieldProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [liveMsg, setLiveMsg] = useState("");

  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const cellRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const panelId = useId();

  const searching = query.trim().length > 0;

  // Flat list of names rendered in DOM order — drives roving tabindex + arrow nav.
  const groups = useMemo(() => groupedCatalog(), []);
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

  // Reset transient state whenever the panel collapses.
  const collapse = (returnFocus: boolean) => {
    setOpen(false);
    setQuery("");
    setActive(0);
    if (returnFocus) triggerRef.current?.focus();
  };

  const openPanel = () => {
    setLiveMsg("");
    setOpen(true);
  };

  // Keep the active index in range as the result set changes.
  useEffect(() => {
    setActive((i) => Math.min(i, Math.max(0, flatNames.length - 1)));
  }, [flatNames.length]);

  // Auto-focus search on open. Retry on the next frame in case the input ref
  // isn't attached yet (panel mounting inside a just-opened dialog).
  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const id = requestAnimationFrame(() => searchRef.current?.focus());
    return () => cancelAnimationFrame(id);
  }, [open]);

  const pick = (icon: IconName) => {
    setLiveMsg(`Selected ${icon}`);
    onSelect(icon);
    collapse(true);
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

  // Two-step Esc: clear a non-empty query first, else collapse + return focus.
  const onSearchKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      // Stop the Escape from bubbling to an enclosing Modal/dialog, which would
      // otherwise also dismiss the editor the icon panel lives inside.
      e.stopPropagation();
      if (searching) {
        setQuery("");
        // Keep focus pinned to the search box across the re-render so the
        // transient blur doesn't escape the field and collapse the panel.
        searchRef.current?.focus();
      } else {
        collapse(true);
      }
      return;
    }
    if (e.key === "ArrowDown" && flatNames.length > 0) {
      e.preventDefault();
      focusCell(active);
    }
  };

  // Focus leaving the whole field (Tab out / click elsewhere in the editor)
  // collapses without changing the selection. A blur with a null relatedTarget
  // is a transient re-render blur (controlled input updating) — re-check the live
  // activeElement on the next frame so we never collapse while focus is still in
  // the field, which would race the two-step Esc.
  const onBlurCapture = (e: React.FocusEvent) => {
    const next = e.relatedTarget as Node | null;
    if (next) {
      if (!rootRef.current?.contains(next)) collapse(false);
      return;
    }
    requestAnimationFrame(() => {
      const active = document.activeElement;
      // Only collapse if focus genuinely left the field for the document body
      // (a real click on empty space), not a transient null-blur mid-render.
      if (active && active !== document.body && !rootRef.current?.contains(active)) {
        collapse(false);
      }
    });
  };

  return (
    <div ref={rootRef} className="space-y-2" onBlurCapture={onBlurCapture}>
      <Button
        ref={triggerRef}
        type="button"
        size="sm"
        variant="outline"
        isDisabled={isDisabled}
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`${label}: change`}
        onPress={() => (open ? collapse(false) : openPanel())}
      >
        <Icon name={value} size={16} />
        Change
        <Icon
          name="chevD"
          size={14}
          className={cx("transition-transform motion-reduce:transition-none", open && "rotate-180")}
        />
      </Button>

      <p aria-live="polite" aria-atomic="true" className="sr-only">
        {liveMsg}
      </p>

      {open && (
        <div id={panelId} className="rounded-[12px] border border-border bg-surface p-2">
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
              className="w-full rounded-[12px] border border-border bg-surface py-2 pr-3 pl-9 text-sm text-foreground outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
            />
          </div>

          <p aria-live="polite" className="sr-only">
            {searching ? `${results.length} ${results.length === 1 ? "icon" : "icons"}` : ""}
          </p>

          <div className="mt-2 max-h-64 overflow-y-auto overscroll-contain pr-1">
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
              <div className="space-y-3">
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
          </div>
        </div>
      )}
    </div>
  );
}

function offsetBefore(groups: ReturnType<typeof groupedCatalog>, index: number): number {
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
    <fieldset
      aria-label={label}
      className="grid grid-cols-6 gap-1.5 sm:grid-cols-8"
      onKeyDown={onKeyDown}
    >
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
              "grid aspect-square min-h-[44px] place-items-center rounded-[12px] border transition-colors",
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
