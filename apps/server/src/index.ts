import { serve } from "@hono/node-server";
import { buildApp } from "./app";
import { assertDbMatchesEnv, loadServerConfig } from "./core/config";
import { initAdmin } from "./core/firebase-admin";
import { createAdminVerifier, makeCreateContext } from "./trpc/context";

const config = loadServerConfig();
assertDbMatchesEnv(config);

const { firestore, auth } = initAdmin(config);

const app = buildApp({
  createContext: makeCreateContext({
    firestore,
    config,
    verifyIdToken: createAdminVerifier(auth),
  }),
});

serve({ fetch: app.fetch, port: config.port }, (info) => {
  console.log(
    `vega server listening on :${info.port} (db=${config.dbName || "(default)"}, env=${config.nodeEnv})`,
  );
});
