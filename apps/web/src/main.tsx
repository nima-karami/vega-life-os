import React from "react";
import ReactDOM from "react-dom/client";
import { RouterProvider } from "react-router";
import { startAuthSync } from "@/app/auth-sync";
import { router } from "@/app/router";
import "@/core/theme/index.css";

startAuthSync();

const rootEl = document.getElementById("root");
if (!rootEl) throw new Error("Root element #root not found");
ReactDOM.createRoot(rootEl).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
