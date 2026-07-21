import type { AddressInfo } from "node:net";
import { type ServerType, serve } from "@hono/node-server";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { type AppDeps, buildApp, type OidcVerifier } from "../app";
import { assertDbMatchesEnv, type ServerConfig } from "../core/config";
import { initAdmin } from "../core/firebase-admin";
import type { ReconcileDeps } from "../features/calendar/reconcile";
import { createReconcileScheduler } from "../features/calendar/schedule-reconcile";
import { refreshAccessToken } from "../features/calendar/token-store";
import { type CalendarContext, makeCreateContext, type TokenVerifier } from "../trpc/context";
import type { AppRouter } from "../trpc/router";
import { resolveEmulatorConfig } from "./emulator";
import { GoogleMock } from "./google-mock";

export type AppClient = ReturnType<typeof createTRPCClient<AppRouter>>;

const TEST_ENCRYPTION_KEY = Buffer.alloc(32, 7).toString("base64");
const OIDC_TOKEN = "scheduler-oidc";

export type TestServer = {
  url: string;
  call: AppClient;
  asUid(uid: string): AppClient;
  firestore: Firestore;
  auth: Auth;
  config: ServerConfig;
  google: GoogleMock;
  reconcileDeps: ReconcileDeps;
  flushReconciles: () => Promise<void>;
  now: () => string;
  close(): Promise<void>;
};

export type BootOptions = {
  verifyIdToken?: TokenVerifier;
  google?: GoogleMock;
  verifyOidc?: OidcVerifier;
  webhookUrl?: string;
  now?: () => string;
  configOverride?: Partial<Pick<ServerConfig, "nodeEnv" | "dbName">>;
};

/** The test stub trusts the bearer string as the uid, so `asUid("u1")` resolves to uid "u1". */
const stubVerifier: TokenVerifier = async (token) => token || null;

export async function bootTestServer(options: BootOptions = {}): Promise<TestServer> {
  const base = resolveEmulatorConfig();
  const config: ServerConfig = {
    ...base,
    ...options.configOverride,
    oauth: {
      ...base.oauth,
      tokenEncryptionKey: base.oauth.tokenEncryptionKey || TEST_ENCRYPTION_KEY,
    },
  };
  assertDbMatchesEnv(config);
  const { firestore, auth } = initAdmin(config);
  const google = options.google ?? new GoogleMock();
  const now = options.now ?? (() => new Date().toISOString());
  const webhookUrl = options.webhookUrl ?? "https://vega.example/webhooks/gcal";

  const tokenDeps = { firestore, gateway: google.gateway, config };
  const getClient = async (uid: string) => {
    await refreshAccessToken(tokenDeps, uid);
    return google.client;
  };
  const reconcileDeps: ReconcileDeps = { firestore, getClient, now, webhookUrl };
  // Large debounce so the router-wired scheduler never auto-fires mid-test and races a
  // test-owned scheduler on the sync lock; tests drive it via flushReconciles()/close().
  const reconcileScheduler = createReconcileScheduler(reconcileDeps, 3_600_000);
  const calendar: CalendarContext = {
    gateway: google.gateway,
    getClient,
    now,
    webhookUrl,
    scheduleReconcile: reconcileScheduler.schedule,
  };
  const verifyOidc: OidcVerifier = options.verifyOidc ?? (async (token) => token === OIDC_TOKEN);

  const deps: AppDeps = {
    createContext: makeCreateContext({
      firestore,
      config,
      verifyIdToken: options.verifyIdToken ?? stubVerifier,
      calendar,
    }),
    firestore,
    calendar,
    verifyOidc,
  };
  const app = buildApp(deps);

  const server = serve({ fetch: app.fetch, port: 0 });
  const port = await resolveListeningPort(server);
  const url = `http://127.0.0.1:${port}`;

  const createClient = (headers?: Record<string, string>): AppClient =>
    createTRPCClient<AppRouter>({
      links: [httpBatchLink({ url: `${url}/trpc`, headers: () => headers ?? {} })],
    });

  return {
    url,
    call: createClient(),
    asUid: (uid) => createClient({ Authorization: `Bearer ${uid}` }),
    firestore,
    auth,
    config,
    google,
    reconcileDeps,
    flushReconciles: () => reconcileScheduler.flush(),
    now,
    close: async () => {
      await reconcileScheduler.flush();
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    },
  };
}

function resolveListeningPort(server: ServerType): Promise<number> {
  const address = server.address();
  if (address && typeof address === "object") return Promise.resolve(address.port);
  return new Promise((resolve) => {
    server.once("listening", () => resolve((server.address() as AddressInfo).port));
  });
}

export const testHelpers = { OIDC_TOKEN, TEST_ENCRYPTION_KEY };
