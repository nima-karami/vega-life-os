import { addDays, format } from "date-fns";
import { todayISO } from "@/core/lib/date";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export interface Parsed {
  date?: string | null;
  time?: string | null;
  rest: string;
}

interface DateToken {
  date: string;
  time?: string;
  pattern: RegExp;
}

interface TimeToken {
  time: string;
  pattern: RegExp;
}

const isoInDays = (days: number) => format(addDays(new Date(), days), "yyyy-MM-dd");

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const padTwo = (n: number) => String(n).padStart(2, "0");

function matchWeekday(phrase: string): DateToken | null {
  const weekdayPattern = (day: string) => new RegExp(`\\b(next\\s+)?${day}\\b`, "i");
  const weekday = WEEKDAYS.find((day) => weekdayPattern(day).test(phrase));
  if (!weekday) return null;
  const daysAhead = (WEEKDAYS.indexOf(weekday) - new Date().getDay() + 7) % 7 || 7;
  return { date: isoInDays(daysAhead), pattern: weekdayPattern(weekday) };
}

function matchDate(phrase: string): DateToken | null {
  if (/\btomorrow\b/i.test(phrase)) return { date: isoInDays(1), pattern: /\btomorrow\b/i };
  if (/\b(today|tonight)\b/i.test(phrase))
    return {
      date: todayISO(),
      time: /\btonight\b/i.test(phrase) ? "21:00" : undefined,
      pattern: /\b(today|tonight)\b/i,
    };
  return matchWeekday(phrase);
}

function toTwentyFourHour(hour: number, meridiem: string | undefined): number {
  if (meridiem === "pm" && hour < 12) return hour + 12;
  if (meridiem === "am" && hour === 12) return 0;
  return hour;
}

// "at 9", "at 9am", "9pm", "21:30"
function matchTime(phrase: string): TimeToken | null {
  const match = phrase.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (!match || !(/\bat\b/i.test(phrase) || match[3] || match[2])) return null;
  const hour = toTwentyFourHour(parseInt(match[1], 10), match[3]?.toLowerCase());
  const minute = match[2] ? parseInt(match[2], 10) : 0;
  if (hour > 23 || minute > 59) return null;
  return {
    time: `${padTwo(hour)}:${padTwo(minute)}`,
    pattern: new RegExp(escapeRegExp(match[0]), "i"),
  };
}

/** Pull simple date/time tokens out of a phrase, returning the cleaned rest. */
export function parseWhen(input: string): Parsed {
  let phrase = ` ${input} `;
  const dateToken = matchDate(phrase);
  if (dateToken) phrase = phrase.replace(dateToken.pattern, " ");
  const timeToken = matchTime(phrase);
  if (timeToken) phrase = phrase.replace(timeToken.pattern, " ");
  const rest = phrase.replace(/\s+/g, " ").trim();
  return { date: dateToken?.date, time: timeToken?.time ?? dateToken?.time, rest };
}
