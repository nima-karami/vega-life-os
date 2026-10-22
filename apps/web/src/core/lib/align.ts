/**
 * Alignment is DERIVED from what an item ladders up to (from data.jsx):
 *   goal  -> aspirational (measured by progress)
 *   value -> maintenance  (measured by consistency)
 *   none  -> logistical   (just needs doing; that's fine)
 */
export type Alignment = "aspirational" | "maintenance" | "logistical";

export function getAlignment(x: { goalId?: string | null; valueId?: string | null }): Alignment {
  if (x.goalId) return "aspirational";
  if (x.valueId) return "maintenance";
  return "logistical";
}

export const ALIGN_LABEL: Record<Alignment, string> = {
  aspirational: "Goal work",
  maintenance: "Upkeep",
  logistical: "Errand",
};
