import { addDays, format, startOfWeek } from "date-fns";
import { mulberry32 } from "./rng";

/** Shared, deterministic scaffolding threaded through every domain builder: date
 *  anchors off the reference week, the RNG, and the running task-id/order counter. */
export interface SeedContext {
  ref: Date;
  weekStart: Date;
  iso: (d: Date) => string;
  dayISO: (i: number) => string;
  yearStart: string;
  yearEnd: string;
  today: string;
  rng: () => number;
  counter: { order: number };
  nextId: () => string;
}

export function createSeedContext(ref: Date): SeedContext {
  const iso = (d: Date) => format(d, "yyyy-MM-dd");
  const weekStart = startOfWeek(ref, { weekStartsOn: 1 }); // Monday
  const counter = { order: 0 };
  return {
    ref,
    weekStart,
    iso,
    dayISO: (i: number) => iso(addDays(weekStart, i)),
    yearStart: iso(new Date(ref.getFullYear(), 0, 1)),
    yearEnd: iso(new Date(ref.getFullYear(), 11, 31)),
    today: iso(ref),
    rng: mulberry32(0x7e6a17),
    counter,
    nextId: () => `t${String(++counter.order).padStart(3, "0")}`,
  };
}
