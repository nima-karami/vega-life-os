import { useStore } from "@/core/store";
import { valueColor } from "./color";

/**
 * Store-bound hook — resolves value by id then delegates to the pure `valueColor()`.
 * Returns neutral fallback for null/undefined/unknown ids, never throws.
 */
export function useValueColor(valueId: string | null | undefined): string {
  const value = useStore((s) =>
    valueId != null ? s.values.find((v) => v.id === valueId) : undefined,
  );
  return valueColor(value);
}
