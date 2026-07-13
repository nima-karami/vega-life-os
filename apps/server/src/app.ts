import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import type { Firestore } from "firebase-admin/firestore";
import { Hono } from "hono";
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
