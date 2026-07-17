import { addDays } from "date-fns";
import type { Dataset } from "../adapter";
import { iso } from "./helpers";

export function buildReviews(weekStart: Date): Dataset["reviews"] {
  // a sample reflection from last week (so the Review history isn't empty)
  return [
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
}
