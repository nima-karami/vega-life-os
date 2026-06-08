import { lazy } from "react";
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

// Lab variants are heavy (three.js) — code-split so the main app stays light.
const named = <T extends string>(p: Promise<Record<T, React.ComponentType>>, k: T) =>
  p.then((m) => ({ default: m[k] }));
const GalaxyVariant = lazy(() => named(import("@/features/lab/variants/GalaxyVariant"), "GalaxyVariant"));
const GlobeVariant = lazy(() => named(import("@/features/lab/variants/GlobeVariant"), "GlobeVariant"));
const ConstellationVariant = lazy(() => named(import("@/features/lab/variants/ConstellationVariant"), "ConstellationVariant"));
const TerminalVariant = lazy(() => named(import("@/features/lab/variants/TerminalVariant"), "TerminalVariant"));
const BlueprintVariant = lazy(() => named(import("@/features/lab/variants/BlueprintVariant"), "BlueprintVariant"));

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
