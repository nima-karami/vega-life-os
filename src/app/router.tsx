import { createBrowserRouter } from "react-router-dom";
import { AppShell } from "./AppShell";
import { Placeholder } from "./Placeholder";
import { CockpitPage } from "@/features/cockpit/CockpitPage";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <AppShell />,
    children: [
      { index: true, element: <CockpitPage /> },
      { path: "map", element: <Placeholder title="map · orbit view" /> },
      { path: "calendar", element: <Placeholder title="calendar · week" /> },
      { path: "board", element: <Placeholder title="board · status" /> },
      { path: "values", element: <Placeholder title="values & goals" /> },
      { path: "habits", element: <Placeholder title="habits · recurrence" /> },
      { path: "analytics", element: <Placeholder title="analytics" /> },
      { path: "library", element: <Placeholder title="library" /> },
      { path: "lab", element: <Placeholder title="lab · variants" /> },
      { path: "*", element: <Placeholder title="404 · off the map" /> },
    ],
  },
]);
