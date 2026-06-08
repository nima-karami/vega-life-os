import type { ValuesSlice } from "@/features/values/store";
import type { GoalsSlice } from "@/features/goals/store";
import type { HabitsSlice } from "@/features/habits/store";
import type { TasksSlice } from "@/features/tasks/store";
import type { LibrarySlice } from "@/features/library/store";
import type { UiSlice } from "./ui";

export interface RootState
  extends ValuesSlice,
    GoalsSlice,
    HabitsSlice,
    TasksSlice,
    LibrarySlice,
    UiSlice {
  ready: boolean;
  bootstrap: () => Promise<void>;
  reseed: () => Promise<void>;
}
