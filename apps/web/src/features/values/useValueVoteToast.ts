import { useCallback } from "react";
import { todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { getTaskLineage } from "@/features/tasks/lineage";
import type { Task } from "@/features/tasks/model";
import { claimVoteToast, formatVoteMessage } from "./vote-toast";

const seenVotes = new Set<string>();

export function useValueVoteToast(): (task: Task) => void {
  const pushToast = useStore((s) => s.pushToast);
  return useCallback(
    (task) => {
      const { values, goals, habits } = useStore.getState();
      const { value } = getTaskLineage(task, { values, goals, habits });
      if (!value || !claimVoteToast(seenVotes, value.id, todayISO())) return;
      pushToast(formatVoteMessage(value));
    },
    [pushToast],
  );
}
