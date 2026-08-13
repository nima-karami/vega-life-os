import type { CalendarEventsSlice } from "@/features/calendar-sync/store";
import type { CardsBulkSlice } from "@/features/cards/bulk-store";
import type { CardsSlice, RetiredMindState } from "@/features/cards/store";
import type { FinanceSlice } from "@/features/finance/store";
import type { GoalsSlice } from "@/features/goals/store";
import type { HabitsSlice } from "@/features/habits/store";
import type { JournalSlice } from "@/features/journal/store";
import type { LibrarySlice } from "@/features/library/store";
import type { ReviewSlice } from "@/features/review/store";
import type { StreaksSlice } from "@/features/streaks/store";
import type { TasksSlice } from "@/features/tasks/store";
import type { ValuesSlice } from "@/features/values/store";
import type { UiSlice } from "./ui";

export interface RootState
  extends ValuesSlice,
    GoalsSlice,
    HabitsSlice,
    TasksSlice,
    LibrarySlice,
    ReviewSlice,
    JournalSlice,
    CalendarEventsSlice,
    CardsSlice,
    CardsBulkSlice,
    RetiredMindState,
    StreaksSlice,
    FinanceSlice,
    UiSlice {
  ready: boolean;
  authUid: string | null;
  authResolved: boolean;
  pendingSignIn: string | null;
  loadFailed: boolean;
  bootstrap: () => Promise<void>;
  seedDemo: () => Promise<void>;
  resetDemo: () => Promise<void>;
  deleteAllData: () => Promise<void>;
  clearLocal: () => Promise<void>;
  confirmPendingSignIn: () => Promise<void>;
  exportJSON: () => string;
  importJSON: (text: string) => Promise<boolean>;
  refetchAll: () => Promise<void>;
  refetchIfChanged: () => Promise<void>;
  refetchCollection: (col: import("@/core/persistence").CollectionName) => Promise<void>;
  onAuthChange: (uid: string | null) => Promise<void>;
}
