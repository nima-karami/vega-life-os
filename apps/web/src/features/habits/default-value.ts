import type { Value } from "@/features/values/model";
import { splitValuesBySeason } from "@/features/values/selectors";
/** A new habit's value: the first in-season one, else any live one, else none. */
export function pickDefaultValueId(values: Value[]): string {
  return splitValuesBySeason(values).inSeason[0]?.id ?? values[0]?.id ?? "";
}
