import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { Hono } from "hono";
import type { ContextFactory } from "./trpc/context";
import { appRouter } from "./trpc/router";

export type AppDeps = {
  createContext: ContextFactory;
};

export function buildApp(deps: AppDeps): Hono {
  const app = new Hono();

  app.get("/health", (c) => c.json({ ok: true }));

  app.all("/trpc/*", (c) =>
    fetchRequestHandler({
      endpoint: "/trpc",
      req: c.req.raw,
      router: appRouter,
      createContext: ({ req }) => deps.createContext({ req }),
    }),
  );

  return app;
}
