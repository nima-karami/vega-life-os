import { createBrowserRouter, Navigate } from "react-router";
import { AnalyticsPage } from "@/features/analytics/AnalyticsPage";
import { CalendarPage } from "@/features/calendar/CalendarPage";
import { CalendarCallbackPage } from "@/features/calendar-sync";
import { BrainWritePage } from "@/features/cards/brainwrite/BrainWritePage";
import { CardsPage } from "@/features/cards/manager/CardsPage";
import { CardPage } from "@/features/cards/page/CardPage";
import { CardPreviewPage } from "@/features/cards/page/CardPreviewPage";
import { FinanceCategoriesPage } from "@/features/finance/FinanceCategoriesPage";
import { FinanceCategoryPage } from "@/features/finance/FinanceCategoryPage";
import { FinanceDashboardPage } from "@/features/finance/FinanceDashboardPage";
import { FinanceImportPage } from "@/features/finance/FinanceImportPage";
import { FinanceNewTransactionPage } from "@/features/finance/FinanceNewTransactionPage";
import { FinanceSettlementPage } from "@/features/finance/FinanceSettlementPage";
import { FinanceTransactionPage } from "@/features/finance/FinanceTransactionPage";
import { FinanceTransactionsPage } from "@/features/finance/FinanceTransactionsPage";
import { GoalPage } from "@/features/goals/GoalPage";
import { HabitPage } from "@/features/habits/HabitPage";
import { HabitsPage } from "@/features/habits/HabitsPage";
import { EntriesPage, JournalPage } from "@/features/journal";
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
          { path: "brainwrite", element: <BrainWritePage /> },
          { path: "scroll", element: <Navigate to="/brainwrite" replace /> },
          { path: "cards", element: <CardsPage /> },
          { path: "cards/new", element: <CardPage /> },
          { path: "cards/:cardId", element: <CardPage /> },
          { path: "cards/:cardId/preview", element: <CardPreviewPage /> },
          { path: "scroll/manage", element: <Navigate to="/cards" replace /> },
          { path: "vocab", element: <Navigate to="/cards" replace /> },
          { path: "finance", element: <FinanceDashboardPage /> },
          { path: "finance/transactions", element: <FinanceTransactionsPage /> },
          { path: "finance/transactions/new", element: <FinanceNewTransactionPage /> },
          { path: "finance/transactions/:transactionId", element: <FinanceTransactionPage /> },
          { path: "finance/import", element: <FinanceImportPage /> },
          { path: "finance/categories", element: <FinanceCategoriesPage /> },
          { path: "finance/categories/:categoryId", element: <FinanceCategoryPage /> },
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
