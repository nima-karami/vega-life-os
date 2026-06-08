import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./AppShell";
import { Placeholder } from "./Placeholder";
import { CockpitPage } from "@/features/cockpit/CockpitPage";
import { MapPage } from "@/features/map/MapPage";
import { CalendarPage } from "@/features/calendar/CalendarPage";
import { BoardPage } from "@/features/board/BoardPage";
import { ValuesGoalsPage } from "@/features/valuesgoals/ValuesGoalsPage";
import { HabitsPage } from "@/features/habits/HabitsPage";
import { AnalyticsPage } from "@/features/analytics/AnalyticsPage";
import { LibraryPage } from "@/features/library/LibraryPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <CockpitPage /> },
      { path: "map", element: <MapPage /> },
      { path: "calendar", element: <CalendarPage /> },
      { path: "board", element: <BoardPage /> },
      { path: "values", element: <ValuesGoalsPage /> },
      { path: "habits", element: <HabitsPage /> },
      { path: "analytics", element: <AnalyticsPage /> },
      { path: "library", element: <LibraryPage /> },
      { path: "lab", element: <Placeholder title="lab · variants" /> },
      { path: "*", element: <Placeholder title="404 · off the map" /> },
    ],
  },
]);
