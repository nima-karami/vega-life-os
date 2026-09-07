import { useCallback, useMemo, useState } from "react";

export interface CardSelection {
  selectedIds: Set<string>;
  isAllVisibleSelected: boolean;
  toggleOne: (id: string) => void;
  /** the header checkbox — selects every visible row, or clears them from the selection */
  toggleVisible: () => void;
  deselect: (id: string) => void;
  clear: () => void;
}

/**
 * Selection outlives the filter and the view toggle by design (spec §4): a bulk action
 * applies to cards the current filter hides, and the bulk bar states the full count.
 */
export function useCardSelection(visibleIds: string[]): CardSelection {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());

  const isAllVisibleSelected = useMemo(
    () => visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id)),
    [visibleIds, selectedIds],
  );

  const toggleOne = useCallback((id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const deselect = useCallback((id: string) => {
    setSelectedIds((current) => {
      if (!current.has(id)) return current;
      const next = new Set(current);
      next.delete(id);
      return next;
    });
  }, []);

  const toggleVisible = useCallback(() => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (visibleIds.every((id) => next.has(id))) {
        for (const id of visibleIds) next.delete(id);
        return next;
      }
      for (const id of visibleIds) next.add(id);
      return next;
    });
  }, [visibleIds]);

  const clear = useCallback(() => setSelectedIds(new Set()), []);

  return { selectedIds, isAllVisibleSelected, toggleOne, toggleVisible, deselect, clear };
}
