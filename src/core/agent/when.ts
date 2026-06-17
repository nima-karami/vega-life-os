import { addDays, format } from "date-fns";
import { todayISO } from "@/core/lib/date";

const WEEKDAYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"];

export interface Parsed {
  date?: string | null;
  time?: string | null;
  rest: string;
}

/** Pull simple date/time tokens out of a phrase, returning the cleaned rest. */
export function parseWhen(input: string): Parsed {
  let s = ` ${input} `;
  let date: string | undefined;
  let time: string | undefined;

  const strip = (re: RegExp) => {
    s = s.replace(re, " ");
  };

  if (/\btomorrow\b/i.test(s)) {
    date = format(addDays(new Date(), 1), "yyyy-MM-dd");
    strip(/\btomorrow\b/i);
  } else if (/\b(today|tonight)\b/i.test(s)) {
    if (/\btonight\b/i.test(s)) time = time ?? "21:00";
    date = todayISO();
    strip(/\b(today|tonight)\b/i);
  } else {
    const wd = WEEKDAYS.find((d) => new RegExp(`\\b(next\\s+)?${d}\\b`, "i").test(s));
    if (wd) {
      const target = WEEKDAYS.indexOf(wd);
      const now = new Date();
      let delta = (target - now.getDay() + 7) % 7;
      if (delta === 0) delta = 7;
      date = format(addDays(now, delta), "yyyy-MM-dd");
      strip(new RegExp(`\\b(next\\s+)?${wd}\\b`, "i"));
    }
  }

  // "at 9", "at 9am", "9pm", "21:30"
  const t = s.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?\b/i);
  if (t && (/\bat\b/i.test(s) || t[3] || t[2])) {
    let h = parseInt(t[1], 10);
    const m = t[2] ? parseInt(t[2], 10) : 0;
    const ap = t[3]?.toLowerCase();
    if (ap === "pm" && h < 12) h += 12;
    if (ap === "am" && h === 12) h = 0;
    if (h <= 23 && m <= 59) {
      time = `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
      strip(new RegExp(t[0].replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i"));
    }
  }

  const rest = s.replace(/\s+/g, " ").trim();
  return { date, time, rest };
}
