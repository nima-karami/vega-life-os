import { type ReviewCreate, resolveReviewForSave } from "@vega/shared";
import type { McpClock } from "../mcp-context";
import { ToolError } from "../tool-result";
import { getLoaded, type LoadedDataset } from "./dataset-loader";
import {
  buildPut,
  findRow,
  type ParsedPatch,
  type PlanOutcome,
  requireRow,
  toResultRecord,
  withIgnoredKeys,
} from "./plan-support";

function toReviewOutcome(
  dataset: LoadedDataset,
  record: Record<string, unknown> & { id: string },
  ignoredKeys: string[],
): PlanOutcome {
  return {
    changeSet: {
      operations: [buildPut("reviews", getLoaded(dataset, "reviews"), record)],
      guards: [],
    },
    result: withIgnoredKeys({ record: toResultRecord(record) }, ignoredKeys),
  };
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
  if (typeof fields.periodKey !== "string")
    throw new ToolError("BAD_REQUEST", "reviews.periodKey: required");
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
  return toReviewOutcome(dataset, record, patch.ignoredKeys);
}

export function planUpdateReview(
  dataset: LoadedDataset,
  id: string,
  patch: ParsedPatch,
): PlanOutcome {
  const reviews = getLoaded(dataset, "reviews");
  const review = requireRow("reviews", reviews, id);
  const next = { ...review, ...(patch.fields as Partial<ReviewCreate>), id };
  const holder = reviews.rows.find((row) => row.id !== id && row.periodKey === next.periodKey);
  if (holder) throw conflictOnPeriod(holder.id, next.periodKey);
  return toReviewOutcome(dataset, next, patch.ignoredKeys);
}
