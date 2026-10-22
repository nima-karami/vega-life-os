import type { Card } from "@vega/shared";
import { useCallback, useState } from "react";
import { pluralize } from "@/core/lib/plural";
import { useStore } from "@/core/store";
import type { CardsBulkResult } from "../bulk-store";
import { describeBulkLearning } from "../manager-query";
import type { UndoBarController } from "../useUndoBar";

interface BulkFailure {
  failedCount: number;
  totalCount: number;
  retry: () => void;
}

export interface CardsBulkActions {
  failure: BulkFailure | null;
  notice: string | null;
  setCategory: (category: string) => void;
  setLearning: (isLearning: boolean) => void;
  hide: () => void;
  remove: () => void;
}

/**
 * Every bulk action lands the same way: a partial commit becomes a retry offer for the
 * failed ids only, a fully-skipped run says why, and anything written offers an undo.
 */
export function useCardsBulk(
  selectedIds: string[],
  today: string,
  undoBar: UndoBarController,
  onDone: () => void,
): CardsBulkActions {
  const patchCards = useStore((s) => s.patchCards);
  const deleteCards = useStore((s) => s.deleteCards);
  const restoreCards = useStore((s) => s.restoreCards);
  const [failure, setFailure] = useState<BulkFailure | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const run = useCallback(
    async (
      describe: (result: CardsBulkResult) => string,
      write: () => Promise<CardsBulkResult>,
    ): Promise<void> => {
      setFailure(null);
      setNotice(null);
      const result = await write();
      if (result.failedIds.length > 0) {
        setFailure({
          failedCount: result.failedIds.length,
          totalCount: result.priorCards.length,
          retry: () => void run(describe, write),
        });
        return;
      }
      if (result.priorCards.length === 0) {
        // Nothing was written because the invariant refused every row — say so, don't go quiet.
        if (result.skippedIds.length > 0) setNotice(describe(result));
        return;
      }
      undoBar.offer(describe(result), () => {
        void restoreCards(result.priorCards);
      });
      onDone();
    },
    [undoBar, restoreCards, onDone],
  );

  const counted = (result: CardsBulkResult, verb: string) =>
    `${pluralize(result.priorCards.length, "card")} ${verb}`;

  return {
    failure,
    notice,
    setCategory: (category) =>
      void run(
        (result) => `${counted(result, "moved to")} “${category}”`,
        () => patchCards(selectedIds, { category }),
      ),
    setLearning: (isLearning) =>
      void run(
        (result) =>
          isLearning
            ? describeBulkLearning(result.priorCards.length, result.skippedIds.length)
            : counted(result, "out of review"),
        () =>
          patchCards(
            selectedIds,
            isLearning
              ? { box: 1, nextDue: today }
              : ({ box: null, nextDue: null, lastReviewed: null } satisfies Partial<Card>),
          ),
      ),
    hide: () =>
      void run(
        (result) => counted(result, "hidden"),
        () => patchCards(selectedIds, { hiddenAt: new Date().toISOString() }),
      ),
    remove: () =>
      void run(
        (result) => counted(result, "deleted"),
        () => deleteCards(selectedIds),
      ),
  };
}
