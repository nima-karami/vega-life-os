import { addDays } from "date-fns";
import type { Book, Movie, VocabEntry } from "@/features/library/model";
import type { Review } from "@/features/review/model";
import type { SeedContext } from "./context";

export interface LibrarySeed {
  books: Book[];
  movies: Movie[];
  vocab: VocabEntry[];
  reviews: Review[];
}

export function buildLibrary(ctx: SeedContext): LibrarySeed {
  const { weekStart, ref, iso } = ctx;
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

  // a sample reflection from last week (so the Review history isn't empty)
  const reviews: Review[] = [
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

  return { books, movies, vocab, reviews };
}
