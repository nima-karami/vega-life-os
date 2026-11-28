import { GRATITUDE_ITEM_MAX, GRATITUDE_SLOTS, isValidISODate, JOURNAL_MAX } from "@vega/shared";
import { isValid, parseISO } from "date-fns";
import type { McpCollection } from "./mcp-collections";

type FieldFormat = { label: string; isValid: (value: unknown) => boolean };

const TIME_OF_DAY = /^([01]\d|2[0-3]):[0-5]\d$/;
const LOCAL_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/;
const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})?$/;
const MINUTES_PER_DAY = 1440;
const MOOD_MAX = 5;
const LEITNER_BOXES = 5;
const SPREAD_MONTHS_MAX = 36;

const isNullish = (value: unknown) => value === null || value === undefined;
const isString = (value: unknown): value is string => typeof value === "string";
const isIntegerIn = (value: unknown, min: number, max: number) =>
  Number.isInteger(value) && (value as number) >= min && (value as number) <= max;

function nullable(format: FieldFormat): FieldFormat {
  return {
    label: `${format.label}, or null`,
    isValid: (value) => isNullish(value) || format.isValid(value),
  };
}

const ISO_DATE: FieldFormat = {
  label: "YYYY-MM-DD",
  isValid: (value) => isString(value) && isValidISODate(value),
};

const TIME: FieldFormat = {
  label: "HH:mm, 24-hour",
  isValid: (value) => isString(value) && TIME_OF_DAY.test(value),
};

const LOCAL_DATE_TIME: FieldFormat = {
  label: "YYYY-MM-DDTHH:mm:ss, local time",
  isValid: (value) => isString(value) && LOCAL_TIMESTAMP.test(value) && isValid(parseISO(value)),
};

const DATE_OR_INSTANT: FieldFormat = {
  label: "YYYY-MM-DD or an ISO 8601 timestamp",
  isValid: (value) =>
    isString(value) &&
    (isValidISODate(value) || (ISO_INSTANT.test(value) && isValid(parseISO(value)))),
};

const CENTS: FieldFormat = {
  label: "a whole number of cents",
  isValid: (value) => Number.isSafeInteger(value),
};

const DURATION: FieldFormat = {
  label: `whole minutes, 0-${MINUTES_PER_DAY}`,
  isValid: (value) => isIntegerIn(value, 0, MINUTES_PER_DAY),
};

const FRACTION: FieldFormat = {
  label: "a fraction from 0 to 1 (0.4 = 40%)",
  isValid: (value) => typeof value === "number" && value >= 0 && value <= 1,
};

const MOOD: FieldFormat = {
  label: `a whole number 1-${MOOD_MAX} (1 = rough, ${MOOD_MAX} = great)`,
  isValid: (value) => isIntegerIn(value, 1, MOOD_MAX),
};

const GRATITUDE: FieldFormat = {
  label: `at most ${GRATITUDE_SLOTS} items of up to ${GRATITUDE_ITEM_MAX} characters`,
  isValid: (value) =>
    Array.isArray(value) &&
    value.length <= GRATITUDE_SLOTS &&
    value.every((item) => isString(item) && item.length <= GRATITUDE_ITEM_MAX),
};

const JOURNAL_TEXT: FieldFormat = {
  label: `up to ${JOURNAL_MAX} characters`,
  isValid: (value) => isString(value) && value.length <= JOURNAL_MAX,
};

const LEITNER_BOX: FieldFormat = {
  label: `a whole number 1-${LEITNER_BOXES}`,
  isValid: (value) => isIntegerIn(value, 1, LEITNER_BOXES),
};

const SPREAD_MONTHS: FieldFormat = {
  label: `whole months, 1-${SPREAD_MONTHS_MAX}`,
  isValid: (value) => isIntegerIn(value, 1, SPREAD_MONTHS_MAX),
};

function isValidSchedule(schedule: unknown): boolean {
  const fields = schedule as Record<string, unknown>;
  if (fields.type === "weekly")
    return (
      Array.isArray(fields.days) &&
      fields.days.length === 7 &&
      fields.days.every((flag) => flag === 0 || flag === 1) &&
      isIntegerIn(fields.interval, 1, 52) &&
      ISO_DATE.isValid(fields.anchor)
    );
  return (
    Array.isArray(fields.daysOfMonth) && fields.daysOfMonth.every((day) => isIntegerIn(day, 1, 31))
  );
}

const SCHEDULE: FieldFormat = {
  label:
    "weekly: days is 7 flags Mon..Sun (1 = on, 0 = off, e.g. [1,0,1,0,1,0,0] for Mon/Wed/Fri), interval a whole number of weeks >= 1, anchor YYYY-MM-DD; monthly: daysOfMonth whole numbers 1-31",
  isValid: isValidSchedule,
};

const SUBGOALS: FieldFormat = {
  label: "subgoals with unique ids and non-empty names",
  isValid: (value) => {
    if (!Array.isArray(value)) return false;
    const ids = value.map((subgoal) => subgoal?.id);
    return (
      new Set(ids).size === ids.length &&
      value.every((subgoal) => isString(subgoal?.name) && subgoal.name.trim() !== "")
    );
  },
};

/** Formats the app's pickers always produce; its pages and calendar sync parse them without a fallback. */
const FIELD_FORMATS: Partial<Record<McpCollection, Record<string, FieldFormat>>> = {
  tasks: {
    date: nullable(ISO_DATE),
    slotDate: nullable(ISO_DATE),
    time: nullable(TIME),
    completedAt: nullable(LOCAL_DATE_TIME),
    durationMin: DURATION,
  },
  habits: {
    time: nullable(TIME),
    durationMin: DURATION,
    createdAt: DATE_OR_INSTANT,
    schedule: SCHEDULE,
  },
  goals: { start: ISO_DATE, end: ISO_DATE, progress: FRACTION, subgoals: SUBGOALS },
  values: { archivedAt: nullable(DATE_OR_INSTANT), restingAt: nullable(DATE_OR_INSTANT) },
  journal: { mood: nullable(MOOD), gratitude: GRATITUDE, journal: JOURNAL_TEXT },
  reviews: { createdAt: DATE_OR_INSTANT },
  cards: {
    box: nullable(LEITNER_BOX),
    nextDue: nullable(ISO_DATE),
    lastReviewed: nullable(DATE_OR_INSTANT),
    addedAt: DATE_OR_INSTANT,
    hiddenAt: nullable(DATE_OR_INSTANT),
    likedAt: nullable(DATE_OR_INSTANT),
  },
  financeTransactions: {
    txnDate: ISO_DATE,
    amountCents: CENTS,
    originalAmountCents: nullable(CENTS),
  },
  financeBudgets: { cents: CENTS },
  financeSettlements: {
    settledBalanceCents: nullable(CENTS),
    paidCents: nullable(CENTS),
    carriedDeltaCents: CENTS,
    settledAt: nullable(DATE_OR_INSTANT),
    paidAt: nullable(DATE_OR_INSTANT),
  },
  financeMerchants: { defaultSpreadMonths: SPREAD_MONTHS },
};

export function getFieldFormat(collection: string, field: string): FieldFormat | undefined {
  return FIELD_FORMATS[collection as McpCollection]?.[field];
}

export function findFormatViolation(collection: string, field: string, value: unknown) {
  const format = getFieldFormat(collection, field);
  return format && !format.isValid(value) ? `expected ${format.label}` : undefined;
}
