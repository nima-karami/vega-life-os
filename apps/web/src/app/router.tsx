import type { ComponentType } from "react";
import { createBrowserRouter, Navigate } from "react-router";
import { CalendarCallbackPage } from "@/features/calendar-sync";
import { GoalPage } from "@/features/goals/GoalPage";
import { HabitPage } from "@/features/habits/HabitPage";
import { HabitsPage } from "@/features/habits/HabitsPage";
import { TodayPage } from "@/features/today/TodayPage";
import { ValuesView } from "@/features/values";
import { ValuePage } from "@/features/values/ValuePage";
import { AppShell } from "./AppShell";
import { BootScreen } from "./BootScreen";
import { NotFound } from "./NotFound";
import { RootBoot } from "./RootBoot";
import { RootError } from "./RootError";

/**
 * Route `lazy` resolves before the navigation commits, so the old page stays up while a
 * chunk loads and no Suspense fallback flashes inside the route fade. The value, goal and
 * habit pages stay eager: they are card → page view-transition targets.
 */
function lazyPage<K extends string, M extends Record<K, ComponentType>>(
  loadModule: () => Promise<M>,
  exportName: K,
) {
  return async () => ({ Component: (await loadModule())[exportName] });
}

export const router = createBrowserRouter([
  {
    element: <RootBoot />,
    errorElement: <RootError />,
    // A direct load of a lazy route waits on its chunk under the boot splash.
    HydrateFallback: BootScreen,
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
          {
            path: "calendar",
            lazy: lazyPage(() => import("@/features/calendar/CalendarPage"), "CalendarPage"),
          },
          { path: "calendar/callback", element: <CalendarCallbackPage /> },
          {
            path: "journal/:date",
            lazy: lazyPage(() => import("@/features/journal/JournalPage"), "JournalPage"),
          },
          {
            path: "entries",
            lazy: lazyPage(() => import("@/features/journal/EntriesPage"), "EntriesPage"),
          },
          {
            path: "brainwrite",
            lazy: lazyPage(
              () => import("@/features/cards/brainwrite/BrainWritePage"),
              "BrainWritePage",
            ),
          },
          { path: "scroll", element: <Navigate to="/brainwrite" replace /> },
          {
            path: "cards",
            lazy: lazyPage(() => import("@/features/cards/manager/CardsPage"), "CardsPage"),
          },
          {
            path: "cards/new",
            lazy: lazyPage(() => import("@/features/cards/page/CardPage"), "CardPage"),
          },
          {
            path: "cards/:cardId",
            lazy: lazyPage(() => import("@/features/cards/page/CardPage"), "CardPage"),
          },
          { path: "scroll/manage", element: <Navigate to="/cards" replace /> },
          { path: "vocab", element: <Navigate to="/cards" replace /> },
          {
            path: "finance",
            lazy: lazyPage(
              () => import("@/features/finance/FinanceDashboardPage"),
              "FinanceDashboardPage",
            ),
          },
          {
            path: "finance/transactions",
            lazy: lazyPage(
              () => import("@/features/finance/FinanceTransactionsPage"),
              "FinanceTransactionsPage",
            ),
          },
          {
            path: "finance/transactions/new",
            lazy: lazyPage(
              () => import("@/features/finance/FinanceNewTransactionPage"),
              "FinanceNewTransactionPage",
            ),
          },
          {
            path: "finance/transactions/:transactionId",
            lazy: lazyPage(
              () => import("@/features/finance/FinanceTransactionPage"),
              "FinanceTransactionPage",
            ),
          },
          {
            path: "finance/import",
            lazy: lazyPage(
              () => import("@/features/finance/FinanceImportPage"),
              "FinanceImportPage",
            ),
          },
          {
            path: "finance/categories",
            lazy: lazyPage(
              () => import("@/features/finance/FinanceCategoriesPage"),
              "FinanceCategoriesPage",
            ),
          },
          {
            path: "finance/categories/:categoryId",
            lazy: lazyPage(
              () => import("@/features/finance/FinanceCategoryPage"),
              "FinanceCategoryPage",
            ),
          },
          {
            path: "finance/settlement",
            lazy: lazyPage(
              () => import("@/features/finance/FinanceSettlementPage"),
              "FinanceSettlementPage",
            ),
          },
          {
            path: "analytics",
            lazy: lazyPage(() => import("@/features/analytics/AnalyticsPage"), "AnalyticsPage"),
          },
          {
            path: "settings",
            lazy: lazyPage(() => import("@/features/settings/SettingsPage"), "SettingsPage"),
          },
          // Catch removed routes + unknown paths → 404 recovery
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
]);
