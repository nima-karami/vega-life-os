import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { Firestore } from "firebase-admin/firestore";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { type ReconcileDeps, runReconcileAll } from "./features/calendar/reconcile";
import { handleWebhook, readWebhookHeaders } from "./features/calendar/webhook";
import type { CalendarContext, ContextFactory } from "./trpc/context";
import { appRouter } from "./trpc/router";

export type OidcVerifier = (token: string | null) => Promise<boolean>;

export type AppDeps = {
  createContext: ContextFactory;
  firestore: Firestore;
  calendar: CalendarContext;
  verifyOidc: OidcVerifier;
};

function readBearer(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" && token ? token : null;
}

export function buildApp(deps: AppDeps): Hono {
  const app = new Hono();
  const reconcileDeps: ReconcileDeps = {
    firestore: deps.firestore,
    getClient: deps.calendar.getClient,
    now: deps.calendar.now,
    webhookUrl: deps.calendar.webhookUrl,
  };

  app.get("/health", (c) => c.json({ ok: true }));

  // The web client is a different origin (Firebase Hosting) than this API (Cloud Run),
  // so the browser needs CORS. Origins are configurable; default to prod + local dev.
  const corsOrigins = (
    process.env.CORS_ORIGINS ??
    "https://vega-life-os.web.app,https://vega-life-os.firebaseapp.com,http://localhost:5180"
  )
    .split(",")
    .map((origin) => origin.trim());
  app.use(
    "/trpc/*",
    cors({
      origin: corsOrigins,
      allowHeaders: ["Authorization", "Content-Type"],
      allowMethods: ["GET", "POST", "OPTIONS"],
      maxAge: 86400,
    }),
  );

  app.all("/trpc/*", (c) =>
    fetchRequestHandler({
      endpoint: "/trpc",
      req: c.req.raw,
      router: appRouter,
      createContext: ({ req }) => deps.createContext({ req }),
    }),
  );

  app.post("/webhooks/gcal", async (c) => {
    const result = await handleWebhook(reconcileDeps, readWebhookHeaders(c.req.raw));
    return c.json(result);
  });

  app.post("/tasks/reconcile", async (c) => {
    const authorized = await deps.verifyOidc(readBearer(c.req.raw));
    if (!authorized) return c.json({ error: "unauthorized" }, 401);
    const result = await runReconcileAll(reconcileDeps);
    return c.json(result);
  });

  return app;
}
