import { createBrowserRouter } from "react-router-dom";
import { RootBoot } from "./RootBoot";
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
import { LabLayout } from "@/features/lab/LabLayout";
import { LabIndex } from "@/features/lab/LabIndex";
import { GalaxyVariant } from "@/features/lab/variants/GalaxyVariant";
import { GlobeVariant } from "@/features/lab/variants/GlobeVariant";
import { ConstellationVariant } from "@/features/lab/variants/ConstellationVariant";
import { TerminalVariant } from "@/features/lab/variants/TerminalVariant";
import { BlueprintVariant } from "@/features/lab/variants/BlueprintVariant";

export const router = createBrowserRouter([
  {
    element: <RootBoot />,
    children: [
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
          { path: "*", element: <Placeholder title="404 · off the map" /> },
        ],
      },
      {
        path: "/lab",
        element: <LabLayout />,
        children: [
          { index: true, element: <LabIndex /> },
          { path: "galaxy", element: <GalaxyVariant /> },
          { path: "globe", element: <GlobeVariant /> },
          { path: "constellation", element: <ConstellationVariant /> },
          { path: "terminal", element: <TerminalVariant /> },
          { path: "blueprint", element: <BlueprintVariant /> },
        ],
      },
    ],
  },
]);
