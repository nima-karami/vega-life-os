import { Button } from "@heroui/react";
import {
  endOfMonth,
  endOfWeek,
  isWithinInterval,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useMemo, useState } from "react";
import { getAlignment } from "@/core/lib/align";
import { todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { cx, Icon, Label, NONE, Select } from "@/core/ui";
import type { Task } from "../model";

type DateRange = "all" | "today" | "week" | "month";
type TypeFilter = "all" | "habit" | "goal" | "errand";

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

function isInRange(date: string | null, range: DateRange): boolean {
  if (range === "all") return true;
  if (!date) return false; // backlog / undated only show under "All"
  if (range === "today") return date === todayISO();
  const parsedDate = parseISO(date);
  const now = new Date();
  const interval =
    range === "week"
      ? { start: startOfWeek(now, { weekStartsOn: 1 }), end: endOfWeek(now, { weekStartsOn: 1 }) }
      : { start: startOfMonth(now), end: endOfMonth(now) };
  return isWithinInterval(parsedDate, interval);
}

function matchesType(task: Task, type: TypeFilter): boolean {
  if (type === "all") return true;
  if (type === "habit") return task.kind === "habit";
  const alignment = getAlignment(task);
  if (type === "goal") return alignment === "aspirational";
  return alignment === "logistical"; // errand
}

/** Holds filter state and derives a task predicate. */
export function useTaskFilter() {
  const [filters, setFilters] = useState<TaskFilters>(DEFAULTS);
  const match = useMemo(() => {
    const trimmedQuery = filters.query.trim().toLowerCase();
    return (t: Task) =>
      isInRange(t.date, filters.range) &&
      (!filters.valueId || t.valueId === filters.valueId) &&
      (!filters.goalId || t.goalId === filters.goalId) &&
      (!trimmedQuery || t.title.toLowerCase().includes(trimmedQuery)) &&
      matchesType(t, filters.type);
  }, [filters]);
  const active =
    filters.range !== "all" ||
    filters.valueId ||
    filters.goalId ||
    filters.query.trim() ||
    filters.type !== "all";
  const clear = () => setFilters(DEFAULTS);
  return { filters, setFilters, match, active: !!active, clear };
}

/** Filter controls bar — calm chip toggles + selects. */
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
    <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
      <div className="relative w-full sm:w-52">
        <Icon
          name="search"
          size={14}
          className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted"
        />
        <input
          type="text"
          value={filters.query}
          onChange={(e) => set({ query: e.target.value })}
          placeholder="Search tasks…"
          aria-label="Search tasks"
          className="h-9 w-full rounded-[12px] border border-border bg-surface pl-8 pr-3 text-[16px] text-foreground outline-none transition-colors placeholder:text-muted focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-focus sm:text-sm"
        />
      </div>

      <div className="flex items-center gap-1.5">
        <Label>When</Label>
        {RANGES.map((r) => (
          <ChipToggle
            key={r.id}
            active={filters.range === r.id}
            onPress={() => set({ range: r.id })}
          >
            {r.label}
          </ChipToggle>
        ))}
      </div>

      <div className="flex items-center gap-2">
        <div className="min-w-[140px]">
          <Select
            ariaLabel="Filter by value"
            value={filters.valueId ?? NONE}
            onValueChange={(v) => set({ valueId: v === NONE ? null : v })}
            options={[
              { value: NONE, label: "Any value" },
              ...values.map((v) => ({ value: v.id, label: v.name, hue: v.hue })),
            ]}
          />
        </div>
        <div className="min-w-[140px]">
          <Select
            ariaLabel="Filter by goal"
            value={filters.goalId ?? NONE}
            onValueChange={(v) => set({ goalId: v === NONE ? null : v })}
            options={[
              { value: NONE, label: "Any goal" },
              ...goals.map((g) => ({ value: g.id, label: g.name })),
            ]}
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5">
        <Label>Type</Label>
        {TYPES.map((t) => (
          <ChipToggle key={t.id} active={filters.type === t.id} onPress={() => set({ type: t.id })}>
            {t.label}
          </ChipToggle>
        ))}
      </div>

      {active && (
        <Button type="button" size="sm" variant="ghost" onPress={onClear}>
          <Icon name="close" size={14} />
          Clear
        </Button>
      )}
    </div>
  );
}

/** Calm pill toggle — a native button styled like a chip, with aria-pressed for SR state. */
function ChipToggle({
  active,
  onPress,
  children,
}: {
  active: boolean;
  onPress: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onPress}
      className={cx(
        "rounded-full px-2.5 py-1 text-xs font-medium transition-colors",
        active
          ? "bg-accent text-accent-foreground"
          : "bg-surface-secondary text-muted hover:text-foreground",
      )}
    >
      {children}
    </button>
  );
}
