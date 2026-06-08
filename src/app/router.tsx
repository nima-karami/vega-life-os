import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./AppShell";
import { Placeholder } from "./Placeholder";
import { CockpitPage } from "@/features/cockpit/CockpitPage";
import { MapPage } from "@/features/map/MapPage";
import { CalendarPage } from "@/features/calendar/CalendarPage";
import { BoardPage } from "@/features/board/BoardPage";
import { ValuesGoalsPage } from "@/features/valuesgoals/ValuesGoalsPage";

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
      { path: "habits", element: <Placeholder title="habits · recurrence" /> },
      { path: "analytics", element: <Placeholder title="analytics" /> },
      { path: "library", element: <Placeholder title="library" /> },
      { path: "lab", element: <Placeholder title="lab · variants" /> },
      { path: "*", element: <Placeholder title="404 · off the map" /> },
    ],
  },
]);
