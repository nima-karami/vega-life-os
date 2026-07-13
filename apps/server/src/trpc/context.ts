import type { Auth } from "firebase-admin/auth";
import type { Firestore } from "firebase-admin/firestore";
import type { ServerConfig } from "../core/config";

export type Context = {
  uid: string | null;
  firestore: Firestore;
  config: ServerConfig;
};

export type TokenVerifier = (idToken: string) => Promise<string | null>;

export type ContextDeps = {
  firestore: Firestore;
  config: ServerConfig;
  verifyIdToken: TokenVerifier;
};

export type ContextFactory = (opts: { req: Request }) => Promise<Context>;

export function createAdminVerifier(auth: Auth): TokenVerifier {
  return async (idToken) => {
    try {
      const decoded = await auth.verifyIdToken(idToken);
      return decoded.uid;
    } catch {
      return null;
    }
  };
}

function readBearerToken(req: Request): string | null {
  const header = req.headers.get("authorization");
  if (!header) return null;
  const [scheme, token] = header.split(" ");
  if (scheme?.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export function makeCreateContext(deps: ContextDeps): ContextFactory {
  return async ({ req }) => {
    const token = readBearerToken(req);
    const uid = token ? await deps.verifyIdToken(token) : null;
    return { uid, firestore: deps.firestore, config: deps.config };
  };
}
