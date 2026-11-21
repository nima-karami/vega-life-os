import { dowIndex, isValidISODate, type ReviewCreate, resolveReviewForSave } from "@vega/shared";
import { ToolError } from "../../../core/tool-error";
import type { McpClock } from "../mcp-context";
import { getLoaded, type LoadedDataset } from "./dataset-loader";
import {
  buildClaimGuard,
  buildInsert,
  buildUpdate,
  findRow,
  type ParsedPatch,
  type PlanOutcome,
  requireRow,
  toResultRecord,
  withIgnoredKeys,
} from "./plan-support";

function toReviewOutcome(
  dataset: LoadedDataset,
  record: Record<string, unknown> & { id: string; periodKey: string },
  ignoredKeys: string[],
  isNew: boolean,
): PlanOutcome {
  const reviews = getLoaded(dataset, "reviews");
  const put = isNew
    ? buildInsert("reviews", reviews, record)
    : buildUpdate("reviews", reviews, record);
  return {
    changeSet: {
      operations: [put],
      guards: [buildClaimGuard("reviews", "periodKey", record.periodKey, record.id)],
    },
    result: withIgnoredKeys({ record: toResultRecord(record) }, ignoredKeys),
    primary: { collection: "reviews", id: record.id },
  };
}

// The app keys a review by its week's Monday; anything else would never match the app's lookup.
function assertPeriodKey(periodKey: unknown): asserts periodKey is string {
  if (typeof periodKey === "string" && isValidISODate(periodKey) && dowIndex(periodKey) === 0)
    return;
  throw new ToolError(
    "BAD_REQUEST",
    "reviews.periodKey: expected the ISO date of the week's Monday (YYYY-MM-DD)",
  );
}

const conflictOnPeriod = (holderId: string, periodKey: string) =>
  new ToolError("CONFLICT", `reviews/${holderId} already holds period ${periodKey}`);

/** One review per period: creating one for a held period updates it in place, as the app does. */
export function planCreateReview(
  dataset: LoadedDataset,
  patch: ParsedPatch,
  explicitId: string | undefined,
  clock: McpClock,
): PlanOutcome {
  const reviews = getLoaded(dataset, "reviews");
  const fields = patch.fields as Partial<ReviewCreate>;
  assertPeriodKey(fields.periodKey);
  const periodKey = fields.periodKey;
  const holder = explicitId ? findRow(reviews, explicitId) : undefined;
  if (holder && holder.periodKey !== periodKey)
    throw new ToolError("CONFLICT", `reviews/${explicitId} already exists for ${holder.periodKey}`);
  const { record, conflictWith } = resolveReviewForSave(
    reviews.rows,
    {
      periodKey,
      prompts: fields.prompts ?? [],
      checkIns: fields.checkIns ?? [],
      createdAt: fields.createdAt,
      id: explicitId,
    },
    clock.nowIso,
    () => `rv_${periodKey}`,
  );
  if (conflictWith) throw conflictOnPeriod(conflictWith, periodKey);
  const isHeld = reviews.rows.some((row) => row.id === record.id && row.periodKey === periodKey);
  return toReviewOutcome(dataset, record, patch.ignoredKeys, !isHeld);
}

export function planUpdateReview(
  dataset: LoadedDataset,
  id: string,
  patch: ParsedPatch,
): PlanOutcome {
  const reviews = getLoaded(dataset, "reviews");
  const review = requireRow("reviews", reviews, id);
  const next = { ...review, ...(patch.fields as Partial<ReviewCreate>), id };
  if (next.periodKey !== review.periodKey) assertPeriodKey(next.periodKey);
  const holder = reviews.rows.find((row) => row.id !== id && row.periodKey === next.periodKey);
  if (holder) throw conflictOnPeriod(holder.id, next.periodKey);
  return toReviewOutcome(dataset, next, patch.ignoredKeys, false);
}
