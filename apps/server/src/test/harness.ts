import type { AddressInfo } from "node:net";
import { type ServerType, serve } from "@hono/node-server";
import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import { buildApp } from "../app";
import { initAdmin } from "../core/firebase-admin";
import { makeCreateContext, type TokenVerifier } from "../trpc/context";
import type { AppRouter } from "../trpc/router";
import { resolveEmulatorConfig } from "./emulator";

export type AppClient = ReturnType<typeof createTRPCClient<AppRouter>>;

export type TestServer = {
  url: string;
  call: AppClient;
  asUid(uid: string): AppClient;
  firestore: Firestore;
  auth: Auth;
  close(): Promise<void>;
};

export type BootOptions = {
  verifyIdToken?: TokenVerifier;
};

/** The test stub trusts the bearer string as the uid, so `asUid("u1")` resolves to uid "u1". */
const stubVerifier: TokenVerifier = async (token) => token || null;

export async function bootTestServer(options: BootOptions = {}): Promise<TestServer> {
  const config = resolveEmulatorConfig();
  const { firestore, auth } = initAdmin(config);
  const app = buildApp({
    createContext: makeCreateContext({
      firestore,
      config,
      verifyIdToken: options.verifyIdToken ?? stubVerifier,
    }),
  });

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
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

function resolveListeningPort(server: ServerType): Promise<number> {
  const address = server.address();
  if (address && typeof address === "object") return Promise.resolve(address.port);
  return new Promise((resolve) => {
    server.once("listening", () => resolve((server.address() as AddressInfo).port));
  });
}
