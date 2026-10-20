import { addDays } from "date-fns";
import type { Dataset } from "../adapter";
import { iso } from "./helpers";

export function buildReviews(weekStart: Date): Dataset["reviews"] {
  // a sample reflection from last week (so the Review history isn't empty)
  return [
    {
      id: "rv1",
      periodKey: iso(addDays(weekStart, -7)),
      checkIns: [
        { valueId: "v1", rating: 4 },
        { valueId: "v2", rating: 3 },
        { valueId: "v3", rating: 2 },
      ],
      createdAt: `${iso(addDays(weekStart, -1))}T20:00`,
      prompts: [
        {
          q: "What are you glad you did this week?",
          a: "Nailed the reading habit every night and shipped two job applications.",
        },
        {
          q: "What got in the way? What's one small next step?",
          a: "Late nights crept back in and cost two morning walks. Next step: lights out by 11.",
        },
        {
          q: "Which value do you want to give more of yourself to next week?",
          a: "Stability — admin piled up and I avoided it.",
        },
        {
          q: "The one thing that matters most next week:",
          a: "Block Tuesday morning for the negotiation prep doc.",
        },
      ],
    },
  ];
}
