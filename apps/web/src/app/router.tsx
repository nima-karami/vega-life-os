import { createBrowserRouter } from "react-router-dom";
import { AnalyticsPage } from "@/features/analytics/AnalyticsPage";
import { CalendarPage } from "@/features/calendar/CalendarPage";
import { CalendarCallbackPage } from "@/features/calendar-sync";
import { HabitsPage } from "@/features/habits/HabitsPage";
import { EntriesPage, JournalPage } from "@/features/journal";
import { ScrollManagePage } from "@/features/scroll/ScrollManagePage";
import { SettingsPage } from "@/features/settings/SettingsPage";
import { TodayPage } from "@/features/today/TodayPage";
import { ValuesView } from "@/features/values";
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
          { path: "habits", element: <HabitsPage /> },
          { path: "calendar", element: <CalendarPage /> },
          { path: "calendar/callback", element: <CalendarCallbackPage /> },
          { path: "journal/:date", element: <JournalPage /> },
          { path: "entries", element: <EntriesPage /> },
          { path: "scroll/manage", element: <ScrollManagePage /> },
          { path: "analytics", element: <AnalyticsPage /> },
          { path: "settings", element: <SettingsPage /> },
          // Catch removed routes + unknown paths → 404 recovery
          { path: "*", element: <NotFound /> },
        ],
      },
    ],
  },
]);
