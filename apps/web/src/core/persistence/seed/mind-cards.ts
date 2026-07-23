import type { MindCard } from "@vega/shared";
import { addDays } from "date-fns";
import { iso } from "./helpers";

const card = (
  id: string,
  category: string,
  title: string,
  body: string,
  daysAgo: number,
): MindCard => ({
  id,
  title,
  body,
  type: "model",
  category,
  source: null,
  addedAt: iso(addDays(new Date(), -daysAgo)),
  hiddenAt: null,
  likedAt: null,
  flippable: true,
  box: null,
  lastReviewed: null,
  nextDue: null,
  updatedAt: "",
  fieldUpdatedAt: {},
});

export function buildMindCards(): MindCard[] {
  return [
    card(
      "mc_inversion",
      "mental models",
      "Inversion",
      "**Solve the problem backward.** Instead of asking how to succeed, ask what would guarantee failure — then avoid those things. Removing the obvious blunders often beats chasing clever wins.",
      30,
    ),
    card(
      "mc_second_order",
      "mental models",
      "Second-order thinking",
      "**Ask: and then what?** First-order effects are obvious; the consequences of those consequences are where the real cost or payoff hides. Trace at least two steps out before you decide.",
      27,
    ),
    card(
      "mc_circle_competence",
      "mental models",
      "Circle of competence",
      "**Know the edge of what you know.** You don't have to be an expert in everything — you have to be honest about where your expertise ends. Staying inside the circle beats wandering confidently outside it.",
      24,
    ),
    card(
      "mc_opportunity_cost",
      "mental models",
      "Opportunity cost",
      "**Every yes is a no to something else.** The true cost of a choice is the best alternative you gave up to make it. Time and attention spent here cannot be spent there — price the road not taken.",
      21,
    ),
    card(
      "mc_anchoring",
      "mental models",
      "Anchoring",
      "**The first number frames the rest.** Once a figure is on the table, every later judgment drifts toward it, even when it's arbitrary. Notice the anchor before you negotiate against it, and set your own when you can.",
      18,
    ),
    card(
      "mc_batna",
      "negotiation",
      "BATNA",
      "**Know your walk-away before you sit down.** Your Best Alternative To a Negotiated Agreement is the floor no deal should fall below. The stronger your BATNA, the calmer and more credible you are at the table.",
      14,
    ),
    card(
      "mc_mirroring",
      "negotiation",
      "Mirroring",
      "**Repeat their last few words, then go quiet.** Mirroring signals you're listening and nudges the other side to expand and clarify. The silence after does the work — resist filling it.",
      10,
    ),
    card(
      "mc_calibrated_questions",
      "negotiation",
      "Calibrated questions",
      '**Ask "how" and "what," never "why."** Open questions that start with how or what hand the other side the problem to solve without triggering defensiveness. "How am I supposed to do that?" invites help instead of a fight.',
      6,
    ),
  ];
}
