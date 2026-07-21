import { serve } from "@hono/node-server";
import { buildApp } from "./app";
import { assertDbMatchesEnv, loadServerConfig } from "./core/config";
import { initAdmin } from "./core/firebase-admin";
import { createGoogleClient } from "./features/calendar/google-client";
import { createOauthGateway } from "./features/calendar/oauth";
import { createOidcVerifier } from "./features/calendar/oidc";
import type { ReconcileDeps } from "./features/calendar/reconcile";
import { createReconcileScheduler } from "./features/calendar/schedule-reconcile";
import { refreshAccessToken } from "./features/calendar/token-store";
import { type CalendarContext, createAdminVerifier, makeCreateContext } from "./trpc/context";

const config = loadServerConfig();
assertDbMatchesEnv(config);

const { firestore, auth } = initAdmin(config);

const publicBaseUrl = process.env.PUBLIC_BASE_URL ?? "";
const gateway = createOauthGateway(config.oauth);
const tokenDeps = { firestore, gateway, config };

const reconcileDeps: ReconcileDeps = {
  firestore,
  getClient: async (uid) => createGoogleClient(await refreshAccessToken(tokenDeps, uid)),
  now: () => new Date().toISOString(),
  webhookUrl: `${publicBaseUrl}/webhooks/gcal`,
};
const reconcileScheduler = createReconcileScheduler(reconcileDeps);

const calendar: CalendarContext = {
  gateway,
  getClient: reconcileDeps.getClient,
  now: reconcileDeps.now,
  webhookUrl: reconcileDeps.webhookUrl,
  scheduleReconcile: reconcileScheduler.schedule,
};

const app = buildApp({
  createContext: makeCreateContext({
    firestore,
    config,
    verifyIdToken: createAdminVerifier(auth),
    calendar,
  }),
  firestore,
  calendar,
  verifyOidc: createOidcVerifier(`${publicBaseUrl}/tasks/reconcile`),
});

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(
    `vega server listening on :${info.port} (db=${config.dbName || "(default)"}, env=${config.nodeEnv})`,
  );
});
