import { addDays, format, startOfWeek } from "date-fns";
import type { Goal } from "@/features/goals/model";
import type { Habit } from "@/features/habits/model";
import type { Book, Movie, VocabEntry } from "@/features/library/model";
import type { Task, TaskStatus } from "@/features/tasks/model";
import type { Value } from "@/features/values/model";
import { type Dataset, emptyDataset } from "./adapter";

/** tiny deterministic RNG so a re-seed during dev produces stable data */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const iso = (d: Date) => format(d, "yyyy-MM-dd");

/**
 * Build the starter dataset anchored to the week containing `ref` (default now),
 * so whenever the user opens VEGA, "today" has a believable, partly-done queue.
 */
export function buildSeed(ref: Date = new Date()): Dataset {
  const ds = emptyDataset();
  const rng = mulberry32(0x7e6a17);

  const weekStart = startOfWeek(ref, { weekStartsOn: 1 }); // Monday
  const dayISO = (i: number) => iso(addDays(weekStart, i));
  const yearStart = iso(new Date(ref.getFullYear(), 0, 1));
  const yearEnd = iso(new Date(ref.getFullYear(), 11, 31));

  // ---------------- VALUES ----------------
  const values: Value[] = [
    {
      id: "v1",
      name: "Courage",
      icon: "shield",
      hue: "#1f1f19",
      spectrum: "courage",
      energy: 0.58,
      order: 0,
      desc: "Act on what scares me, lean into hard conversations.",
      archivedAt: null,
    },
    {
      id: "v2",
      name: "Presence",
      icon: "eye",
      hue: "#3a3a32",
      spectrum: "presence",
      energy: 0.82,
      order: 1,
      desc: "Be here. Less screen, more attention.",
      archivedAt: null,
    },
    {
      id: "v3",
      name: "Self-care",
      icon: "heart",
      hue: "#55554c",
      spectrum: "selfcare",
      energy: 0.66,
      order: 2,
      desc: "Protect sleep, body and mind so the rest holds.",
      archivedAt: null,
    },
    {
      id: "v4",
      name: "Stability",
      icon: "card",
      hue: "#7a7a6f",
      spectrum: "stability",
      energy: 0.34,
      order: 3,
      desc: "Keep the foundations steady — money, home, admin.",
      archivedAt: null,
    },
    {
      id: "v5",
      name: "Vitality",
      icon: "flash",
      hue: "#94948a",
      spectrum: "vitality",
      energy: 0.5,
      order: 4,
      desc: "Move daily, eat well, keep the engine running.",
      archivedAt: null,
    },
  ];
  ds.values = values;

  // ---------------- GOALS ----------------
  const goals: Goal[] = [
    {
      id: "g1",
      valueId: "v1",
      name: "Get a higher-paying job",
      icon: "briefcase",
      status: "active",
      start: iso(addDays(weekStart, -7)),
      end: iso(addDays(weekStart, 35)),
      progress: 0.42,
      order: 0,
      subgoals: [
        { id: "s1", name: "Rewrite résumé + portfolio", done: true },
        { id: "s2", name: "Reach out to 10 people", done: true },
        { id: "s3", name: "Apply to 15 roles", done: false },
        { id: "s4", name: "Land 3 final-round interviews", done: false },
      ],
    },
    {
      id: "g2",
      valueId: "v2",
      name: "Read 24 books this year",
      icon: "book",
      status: "active",
      start: yearStart,
      end: yearEnd,
      progress: 0.46,
      order: 1,
      subgoals: [
        { id: "s5", name: "Build a nightly reading habit", done: true },
        { id: "s6", name: "Finish the current stack of 4", done: false },
      ],
    },
    {
      id: "g3",
      valueId: "v3",
      name: "Sleep 7.5h consistently",
      icon: "heart",
      status: "paused",
      start: iso(addDays(weekStart, -28)),
      end: iso(addDays(weekStart, 21)),
      progress: 0.61,
      order: 2,
      subgoals: [
        { id: "s7", name: "Fixed wind-down at 10:30", done: true },
        { id: "s8", name: "No screens in bed", done: false },
      ],
    },
    {
      id: "g4",
      valueId: "v5",
      name: "Run a 10k",
      icon: "flash",
      status: "active",
      start: iso(addDays(weekStart, -14)),
      end: iso(addDays(weekStart, 56)),
      progress: 0.3,
      order: 3,
      subgoals: [
        { id: "s9", name: "Couch-to-5k finished", done: true },
        { id: "s10", name: "Hold 5k under 30 min", done: false },
        { id: "s11", name: "First parkrun", done: false },
      ],
    },
  ];
  ds.goals = goals;

  // ---------------- HABITS ----------------
  // days: Mon..Sun mask
  const createdAt = iso(addDays(weekStart, -60));
  const habits: Habit[] = (
    [
      {
        id: "h1",
        name: "Read 1h before bed",
        goalId: "g2",
        valueId: "v2",
        icon: "book",
        time: "21:30",
        recurrence: "Every day",
        days: [1, 1, 1, 1, 1, 1, 1],
        durationMin: 60,
        createdAt,
      },
      {
        id: "h2",
        name: "Apply to 1 role",
        goalId: "g1",
        valueId: "v1",
        icon: "briefcase",
        time: "09:00",
        recurrence: "Weekdays",
        days: [1, 1, 1, 1, 1, 0, 0],
        durationMin: 45,
        createdAt,
      },
      {
        id: "h3",
        name: "Lights out by 22:30",
        goalId: "g3",
        valueId: "v3",
        icon: "heart",
        time: "22:30",
        recurrence: "Every day",
        days: [1, 1, 1, 1, 1, 1, 1],
        durationMin: 30,
        createdAt,
      },
      {
        id: "h4",
        name: "Morning walk",
        goalId: null,
        valueId: "v5",
        icon: "flash",
        time: "07:30",
        recurrence: "Mon / Wed / Fri",
        days: [1, 0, 1, 0, 1, 0, 0],
        durationMin: 45,
        createdAt,
      },
      {
        id: "h5",
        name: "Pay the bills",
        goalId: null,
        valueId: "v4",
        icon: "card",
        time: "10:00",
        recurrence: "Monthly · 1st",
        days: [1, 0, 0, 0, 0, 0, 0],
        durationMin: 45,
        createdAt,
      },
      {
        id: "h6",
        name: "Tidy 15 min",
        goalId: null,
        valueId: "v3",
        icon: "heart",
        time: "18:30",
        recurrence: "Every day",
        days: [1, 1, 1, 1, 1, 1, 1],
        durationMin: 15,
        createdAt,
      },
      {
        id: "h7",
        name: "Call family",
        goalId: null,
        valueId: "v2",
        icon: "eye",
        time: "19:00",
        recurrence: "Sundays",
        days: [0, 0, 0, 0, 0, 0, 1],
        durationMin: 40,
        createdAt,
      },
      {
        id: "h8",
        name: "Workout 30 min",
        goalId: "g4",
        valueId: "v5",
        icon: "flash",
        time: "18:00",
        recurrence: "Tue / Thu / Sat",
        days: [0, 1, 0, 1, 0, 1, 0],
        durationMin: 30,
        createdAt,
      },
      {
        // an "anytime" habit — no time; tracked in Today's Daily-habits strip, off the calendar
        id: "h9",
        name: "Drink water",
        goalId: null,
        valueId: "v3",
        icon: "spark",
        time: null,
        recurrence: "Every day",
        days: [1, 1, 1, 1, 1, 1, 1],
        durationMin: 5,
        createdAt,
      },
    ] as Omit<Habit, "archivedAt">[]
  ).map((h) => ({ ...h, archivedAt: null }));
  ds.habits = habits;

  // ---------------- TASKS (habit instances across this week) ----------------
  const tasks: Task[] = [];
  let order = 0;
  const tid = () => `t${String(++order).padStart(3, "0")}`;

  // morning-ish tasks (time < 14:00) on `today` count as done; later ones todo
  const today = iso(ref);
  const statusForDate = (dateStr: string, time: string | null): TaskStatus => {
    if (dateStr < today) {
      const r = rng();
      if (r < 0.12) return "skip";
      if (r < 0.2) return "todo"; // a few honest misses
      return "done";
    }
    if (dateStr === today) {
      if (!time) return "todo"; // anytime habit: leave today's unchecked so it can be ticked
      const hour = parseInt(time.slice(0, 2), 10);
      return hour < 14 ? "done" : "todo";
    }
    return "todo";
  };

  // generate ~12 weeks of history + the current week (drives streaks/analytics/heatmap)
  const FROM = -84;
  const TO = 6;
  for (const h of habits) {
    for (let off = FROM; off <= TO; off++) {
      const dow = ((off % 7) + 7) % 7; // weekStart is Monday -> index 0
      if (!h.days[dow]) continue;
      const dateStr = iso(addDays(weekStart, off));
      const status = statusForDate(dateStr, h.time);
      tasks.push({
        id: tid(),
        title: h.name,
        kind: "habit",
        habitId: h.id,
        goalId: h.goalId,
        valueId: h.valueId,
        date: dateStr,
        time: h.time,
        durationMin: h.durationMin,
        status,
        detached: false,
        note: "",
        order,
      });
    }
  }

  // a detached habit instance (moved earlier + note) — Wed reading
  const wedRead = tasks.find((t) => t.habitId === "h1" && t.date === dayISO(2));
  if (wedRead) {
    wedRead.title = "Read — finish 'Sapiens' ch.9";
    wedRead.time = "20:00";
    wedRead.detached = true;
    wedRead.note = "Moved earlier — dinner plans. Reading Sapiens, not the new stack.";
  }
  // a meaningful note on a done apply
  const monApply = tasks.find((t) => t.habitId === "h2" && t.date === dayISO(0));
  if (monApply) monApply.note = "Sent to Northwind — analyst role.";

  // one-off scheduled tasks
  tasks.push({
    id: tid(),
    title: "Update ID card",
    kind: "oneoff",
    habitId: null,
    goalId: null,
    valueId: "v4",
    date: dayISO(3),
    time: "13:00",
    durationMin: 60,
    status: "todo",
    detached: false,
    note: "Photo + form at city office. Bring old card.",
    order,
  });
  tasks.push({
    id: tid(),
    title: "Mock interview w/ Dana",
    kind: "oneoff",
    habitId: null,
    goalId: "g1",
    valueId: "v1",
    date: dayISO(4),
    time: "16:00",
    durationMin: 60,
    status: "todo",
    detached: false,
    note: "",
    order,
  });
  // an all-day (dated, untimed) one-off — sits in the calendar's all-day row,
  // draggable onto the grid or schedulable via its menu
  tasks.push({
    id: tid(),
    title: "Pick up dry cleaning",
    kind: "oneoff",
    habitId: null,
    goalId: null,
    valueId: "v4",
    date: dayISO(1),
    time: null,
    durationMin: 60,
    status: "todo",
    detached: false,
    note: "Ready after 4pm.",
    order,
  });
  ds.tasks = tasks;

  // ---------------- BACKLOG (undated one-offs) ----------------
  const backlog: Task[] = [
    {
      id: tid(),
      title: "Renew passport",
      kind: "oneoff",
      habitId: null,
      goalId: null,
      valueId: "v4",
      date: null,
      time: null,
      durationMin: 60,
      status: "open",
      detached: false,
      note: "",
      order,
    },
    {
      id: tid(),
      title: "Negotiation prep doc",
      kind: "oneoff",
      habitId: null,
      goalId: "g1",
      valueId: "v1",
      date: null,
      time: null,
      durationMin: 90,
      status: "open",
      detached: false,
      note: "Salary research + scripts.",
      order,
    },
    {
      id: tid(),
      title: "Set up reading nook",
      kind: "oneoff",
      habitId: null,
      goalId: "g2",
      valueId: "v2",
      date: null,
      time: null,
      durationMin: 60,
      status: "open",
      detached: false,
      note: "",
      order,
    },
    {
      id: tid(),
      title: "Buy blackout curtains",
      kind: "oneoff",
      habitId: null,
      goalId: "g3",
      valueId: "v3",
      date: null,
      time: null,
      durationMin: 30,
      status: "open",
      detached: false,
      note: "",
      order,
    },
    {
      id: tid(),
      title: "Sort out tax documents",
      kind: "oneoff",
      habitId: null,
      goalId: null,
      valueId: "v4",
      date: null,
      time: null,
      durationMin: 90,
      status: "open",
      detached: false,
      note: "No deadline yet.",
      order,
    },
    {
      id: tid(),
      title: "Plan a long weekend trip",
      kind: "oneoff",
      habitId: null,
      goalId: null,
      valueId: "v5",
      date: null,
      time: null,
      durationMin: 60,
      status: "open",
      detached: false,
      note: "",
      order,
    },
  ];
  ds.tasks.push(...backlog);

  // energy lens (charge / drain) by activity — what lifts vs. costs you
  const ENERGY_BY_TITLE: Record<string, "charge" | "drain" | "neutral"> = {
    "Read 1h before bed": "charge",
    "Read — finish 'Sapiens' ch.9": "charge",
    "Apply to 1 role": "drain",
    "Lights out by 22:30": "neutral",
    "Morning walk": "charge",
    "Workout 30 min": "charge",
    "Pay the bills": "drain",
    "Tidy 15 min": "neutral",
    "Call family": "charge",
    "Update ID card": "drain",
    "Mock interview w/ Dana": "drain",
    "Negotiation prep doc": "drain",
    "Sort out tax documents": "drain",
    "Renew passport": "drain",
    "Set up reading nook": "charge",
    "Buy blackout curtains": "neutral",
    "Plan a long weekend trip": "charge",
  };
  ds.tasks.forEach((t) => {
    t.energy = ENERGY_BY_TITLE[t.title] ?? "neutral";
  });

  // ---------------- LIBRARY ----------------
  const books: Book[] = [
    {
      id: "b1",
      title: "Sapiens",
      author: "Yuval Noah Harari",
      status: "reading",
      rating: null,
      pages: 443,
      currentPage: 210,
      startedAt: iso(addDays(weekStart, -20)),
      finishedAt: null,
      valueId: "v2",
      note: "Ch.9 next.",
      order: 0,
    },
    {
      id: "b2",
      title: "Atomic Habits",
      author: "James Clear",
      status: "finished",
      rating: 4,
      pages: 320,
      currentPage: 320,
      startedAt: iso(addDays(weekStart, -90)),
      finishedAt: iso(addDays(weekStart, -40)),
      valueId: "v3",
      note: "1% better every day.",
      order: 1,
    },
    {
      id: "b3",
      title: "The Pragmatic Programmer",
      author: "Hunt & Thomas",
      status: "finished",
      rating: 5,
      pages: 352,
      currentPage: 352,
      startedAt: iso(addDays(weekStart, -140)),
      finishedAt: iso(addDays(weekStart, -70)),
      valueId: "v1",
      note: "",
      order: 2,
    },
    {
      id: "b4",
      title: "Project Hail Mary",
      author: "Andy Weir",
      status: "reading",
      rating: null,
      pages: 496,
      currentPage: 88,
      startedAt: iso(addDays(weekStart, -6)),
      finishedAt: null,
      valueId: "v2",
      note: "",
      order: 3,
    },
    {
      id: "b5",
      title: "Dune",
      author: "Frank Herbert",
      status: "queued",
      rating: null,
      pages: 688,
      currentPage: null,
      startedAt: null,
      finishedAt: null,
      valueId: "v2",
      note: "",
      order: 4,
    },
    {
      id: "b6",
      title: "Deep Work",
      author: "Cal Newport",
      status: "queued",
      rating: null,
      pages: 296,
      currentPage: null,
      startedAt: null,
      finishedAt: null,
      valueId: "v1",
      note: "",
      order: 5,
    },
  ];
  ds.books = books;

  const movies: Movie[] = [
    {
      id: "m1",
      title: "Blade Runner 2049",
      year: 2017,
      director: "Denis Villeneuve",
      status: "watched",
      rating: 5,
      watchedAt: iso(addDays(weekStart, -10)),
      note: "Gosling. Light. Rain.",
      order: 0,
    },
    {
      id: "m2",
      title: "Dune: Part Two",
      year: 2024,
      director: "Denis Villeneuve",
      status: "watched",
      rating: 5,
      watchedAt: iso(addDays(weekStart, -3)),
      note: "",
      order: 1,
    },
    {
      id: "m3",
      title: "Past Lives",
      year: 2023,
      director: "Celine Song",
      status: "watched",
      rating: 4,
      watchedAt: iso(addDays(weekStart, -18)),
      note: "",
      order: 2,
    },
    {
      id: "m4",
      title: "Oppenheimer",
      year: 2023,
      director: "Christopher Nolan",
      status: "queued",
      rating: null,
      watchedAt: null,
      note: "",
      order: 3,
    },
    {
      id: "m5",
      title: "The Zone of Interest",
      year: 2023,
      director: "Jonathan Glazer",
      status: "queued",
      rating: null,
      watchedAt: null,
      note: "",
      order: 4,
    },
  ];
  ds.movies = movies;

  const vocab: VocabEntry[] = [
    {
      id: "w1",
      term: "petrichor",
      definition: "The pleasant earthy smell after rain falls on dry ground.",
      example: "The petrichor rose as the first drops hit the pavement.",
      language: "English",
      box: 3,
      lastReviewed: iso(addDays(ref, -2)),
      nextDue: iso(addDays(ref, 2)),
      addedAt: iso(addDays(weekStart, -12)),
    },
    {
      id: "w2",
      term: "saudade",
      definition: "A deep, nostalgic longing for something absent.",
      example: "A quiet saudade for the city she left behind.",
      language: "Portuguese",
      box: 2,
      lastReviewed: iso(addDays(ref, -1)),
      nextDue: iso(ref),
      addedAt: iso(addDays(weekStart, -8)),
    },
    {
      id: "w3",
      term: "sonder",
      definition: "The realization that each passerby lives a life as vivid as your own.",
      example: "A wave of sonder on the crowded platform.",
      language: "English",
      box: 1,
      lastReviewed: null,
      nextDue: iso(ref),
      addedAt: iso(addDays(weekStart, -2)),
    },
    {
      id: "w4",
      term: "ataraxia",
      definition: "A state of serene calm and freedom from worry.",
      example: "Months of practice brought a hard-won ataraxia.",
      language: "Greek",
      box: 4,
      lastReviewed: iso(addDays(ref, -5)),
      nextDue: iso(addDays(ref, 5)),
      addedAt: iso(addDays(weekStart, -30)),
    },
    {
      id: "w5",
      term: "wabi-sabi",
      definition: "Finding beauty in imperfection and impermanence.",
      example: "The cracked bowl had a wabi-sabi grace.",
      language: "Japanese",
      box: 2,
      lastReviewed: iso(addDays(ref, -3)),
      nextDue: iso(addDays(ref, 1)),
      addedAt: iso(addDays(weekStart, -16)),
    },
  ];
  ds.vocab = vocab;

  // a sample reflection from last week (so the Review history isn't empty)
  ds.reviews = [
    {
      id: "rv1",
      periodKey: iso(addDays(weekStart, -7)),
      completion: 0.78,
      createdAt: `${iso(addDays(weekStart, -1))}T20:00`,
      prompts: [
        {
          q: "What went well this week?",
          a: "Nailed the reading habit every night and shipped two job applications.",
        },
        {
          q: "What slipped, and why?",
          a: "Skipped two morning walks — late nights crept back in.",
        },
        {
          q: "Which value got too little of you?",
          a: "Stability. Admin piled up and I avoided it.",
        },
        {
          q: "The one thing that matters most next week:",
          a: "Block Tuesday morning for the negotiation prep doc.",
        },
      ],
    },
  ];

  return ds;
}
