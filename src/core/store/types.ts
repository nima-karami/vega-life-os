import type { ValuesSlice } from "@/features/values/store";
import type { GoalsSlice } from "@/features/goals/store";
import type { HabitsSlice } from "@/features/habits/store";
import type { TasksSlice } from "@/features/tasks/store";
import type { LibrarySlice } from "@/features/library/store";
import type { ReviewSlice } from "@/features/review/store";
import type { UiSlice } from "./ui";

export interface RootState
  extends ValuesSlice,
    GoalsSlice,
    HabitsSlice,
    TasksSlice,
    LibrarySlice,
    ReviewSlice,
    UiSlice {
  ready: boolean;
  bootstrap: () => Promise<void>;
  reseed: () => Promise<void>;
  wipe: () => Promise<void>;
  exportJSON: () => string;
  importJSON: (text: string) => Promise<boolean>;
}
