import { createBrowserRouter } from "react-router";
import { AnalyticsPage } from "@/features/analytics/AnalyticsPage";
import { CalendarPage } from "@/features/calendar/CalendarPage";
import { CalendarCallbackPage } from "@/features/calendar-sync";
import { ScrollManagePage } from "@/features/cards/ScrollManagePage";
import { ScrollPage } from "@/features/cards/ScrollPage";
import { FinanceCategoriesPage } from "@/features/finance/FinanceCategoriesPage";
import { FinanceDashboardPage } from "@/features/finance/FinanceDashboardPage";
import { FinanceImportPage } from "@/features/finance/FinanceImportPage";
import { FinanceSettlementPage } from "@/features/finance/FinanceSettlementPage";
import { FinanceTransactionsPage } from "@/features/finance/FinanceTransactionsPage";
import { GoalPage } from "@/features/goals/GoalPage";
import { HabitPage } from "@/features/habits/HabitPage";
import { HabitsPage } from "@/features/habits/HabitsPage";
import { EntriesPage, JournalPage } from "@/features/journal";
import { VocabPage } from "@/features/library/VocabPage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { TodayPage } from "@/features/today/TodayPage";
import { ValuesView } from "@/features/values";
import { ValuePage } from "@/features/values/ValuePage";
import { AppShell } from "./AppShell";
import { NotFound } from "./NotFound";
import { RootBoot } from "./RootBoot";

export const router = createBrowserRouter([
  {
    element: <RootBoot />,
    children: [
      {
        path: "/",
        element: <AppShell />,
        children: [
          // /today is the index AND has a named path for direct links/bookmarks
          { index: true, element: <TodayPage /> },
          { path: "today", element: <TodayPage /> },
          { path: "values", element: <ValuesView /> },
          { path: "values/:valueId", element: <ValuePage /> },
          { path: "goals/:goalId", element: <GoalPage /> },
          { path: "habits", element: <HabitsPage /> },
          { path: "habits/:habitId", element: <HabitPage /> },
          { path: "calendar", element: <CalendarPage /> },
          { path: "calendar/callback", element: <CalendarCallbackPage /> },
          { path: "journal/:date", element: <JournalPage /> },
          { path: "entries", element: <EntriesPage /> },
          { path: "scroll", element: <ScrollPage /> },
          { path: "scroll/manage", element: <ScrollManagePage /> },
          { path: "vocab", element: <VocabPage /> },
          { path: "finance", element: <FinanceDashboardPage /> },
          { path: "finance/transactions", element: <FinanceTransactionsPage /> },
          { path: "finance/import", element: <FinanceImportPage /> },
          { path: "finance/categories", element: <FinanceCategoriesPage /> },
          { path: "finance/settlement", element: <FinanceSettlementPage /> },
          { path: "analytics", element: <AnalyticsPage /> },
          { path: "settings", element: <SettingsPage /> },
          // Catch removed routes + unknown paths → 404 recovery
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
]);
