import { useMemo, useState } from "react";
import {
  endOfMonth,
  endOfWeek,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useStore } from "@/core/store";
import { cx, Label, Icon, Select, NONE } from "@/core/ui";
import { alignOf } from "@/core/lib/align";
import { todayISO } from "@/core/lib/date";
import type { Task } from "../model";

export type DateRange = "all" | "today" | "week" | "month";
export type TypeFilter = "all" | "habit" | "goal" | "errand";

export interface TaskFilters {
  range: DateRange;
  valueId: string | null;
  goalId: string | null;
  query: string;
  type: TypeFilter;
}

const DEFAULTS: TaskFilters = { range: "all", valueId: null, goalId: null, query: "", type: "all" };

const RANGES: { id: DateRange; label: string }[] = [
  { id: "all", label: "All" },
  { id: "today", label: "Today" },
  { id: "week", label: "This week" },
  { id: "month", label: "This month" },
];
const TYPES: { id: TypeFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "habit", label: "Habit" },
  { id: "goal", label: "Goal work" },
  { id: "errand", label: "Errand" },
];

function inRange(date: string | null, range: DateRange): boolean {
  if (range === "all") return true;
  if (!date) return false; // backlog / undated only show under "All"
  if (range === "today") return date === todayISO();
  const d = parseISO(date);
  const now = new Date();
  const interval =
    range === "week"
      ? { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
      : { start: startOfMonth(now), end: endOfMonth(now) };
  return isWithinInterval(d, interval);
}

function matchType(t: Task, type: TypeFilter): boolean {
  if (type === "all") return true;
  if (type === "habit") return t.kind === "habit";
  const a = alignOf(t);
  if (type === "goal") return a === "aspirational";
  return a === "logistical"; // errand
}

/** Holds filter state and derives a task predicate. */
export function useTaskFilter() {
  const [filters, setFilters] = useState<TaskFilters>(DEFAULTS);
  const match = useMemo(() => {
    const q = filters.query.trim().toLowerCase();
    return (t: Task) =>
      inRange(t.date, filters.range) &&
      (!filters.valueId || t.valueId === filters.valueId) &&
      (!filters.goalId || t.goalId === filters.goalId) &&
      (!q || t.title.toLowerCase().includes(q)) &&
      matchType(t, filters.type);
  }, [filters]);
  const active =
    filters.range !== "all" || filters.valueId || filters.goalId || filters.query.trim() || filters.type !== "all";
  const clear = () => setFilters(DEFAULTS);
  return { filters, setFilters, match, active: !!active, clear };
}

const chip = (on: boolean) =>
  cx("mono border px-2.5 py-1 text-[10px] uppercase tracking-[0.1em] transition-colors",
    on ? "border-ink bg-ink text-paper" : "border-[var(--color-line)] text-stone hover:border-ink");

/** Filter controls bar — styled like the calendar focus filter. */
export function TaskFilterBar({
  filters,
  onChange,
  onClear,
  active,
}: {
  filters: TaskFilters;
  onChange: (f: TaskFilters) => void;
  onClear: () => void;
  active: boolean;
}) {
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const set = (patch: Partial<TaskFilters>) => onChange({ ...filters, ...patch });

  return (
    <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-2">
      {/* search */}
      <div className="flex items-center gap-1.5 border border-[var(--color-line)] px-2 py-1">
        <Icon name="search" size={13} className="text-stone" />
        <input
          value={filters.query}
          onChange={(e) => set({ query: e.target.value })}
          placeholder="search tasks…"
          className="mono w-40 bg-transparent text-[11px] outline-none placeholder:text-mist"
        />
      </div>

      {/* date range */}
      <div className="flex items-center gap-1.5">
        <Label>when</Label>
        {RANGES.map((r) => (
          <button key={r.id} onClick={() => set({ range: r.id })} className={chip(filters.range === r.id)}>{r.label}</button>
        ))}
      </div>

      {/* value + goal */}
      <div className="flex items-center gap-2">
        <div className="min-w-[120px] border border-[var(--color-line)] px-2 py-1">
          <Select
            ariaLabel="Filter by value"
            value={filters.valueId ?? NONE}
            onValueChange={(v) => set({ valueId: v === NONE ? null : v })}
            options={[{ value: NONE, label: "Any value" }, ...values.map((v) => ({ value: v.id, label: v.name, hue: v.hue }))]}
          />
        </div>
        <div className="min-w-[120px] border border-[var(--color-line)] px-2 py-1">
          <Select
            ariaLabel="Filter by goal"
            value={filters.goalId ?? NONE}
            onValueChange={(v) => set({ goalId: v === NONE ? null : v })}
            options={[{ value: NONE, label: "Any goal" }, ...goals.map((g) => ({ value: g.id, label: g.name }))]}
          />
        </div>
      </div>

      {/* type */}
      <div className="flex items-center gap-1.5">
        <Label>type</Label>
        {TYPES.map((t) => (
          <button key={t.id} onClick={() => set({ type: t.id })} className={chip(filters.type === t.id)}>{t.label}</button>
        ))}
      </div>

      {active && (
        <button onClick={onClear} className="mono flex items-center gap-1 text-[10px] uppercase tracking-[0.1em] text-stone hover:text-signal">
          <Icon name="close" size={12} /> clear
        </button>
      )}
    </div>
  );
}
