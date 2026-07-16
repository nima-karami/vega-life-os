import { createTRPCClient, httpBatchLink } from "@trpc/client";
import type { AppRouter } from "@vega/server/src/trpc/router";
import { auth } from "@/core/firebase/app";

const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? "http://127.0.0.1:8787";

async function authHeaders(): Promise<Record<string, string>> {
  const token = await auth?.currentUser?.getIdToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export type TrpcClient = ReturnType<typeof createTRPCClient<AppRouter>>;

/** A typed tRPC client for the signed-in backend. Every request carries the current Firebase ID token. */
export function createTrpcClient(): TrpcClient {
  return createTRPCClient<AppRouter>({
    links: [httpBatchLink({ url: `${apiUrl}/trpc`, headers: authHeaders })],
  });
}

let sharedClient: TrpcClient | null = null;

/** The process-wide tRPC client for direct procedure calls from UI (e.g. calendar connect). */
export function getTrpcClient(): TrpcClient {
  sharedClient ??= createTrpcClient();
  return sharedClient;
}
