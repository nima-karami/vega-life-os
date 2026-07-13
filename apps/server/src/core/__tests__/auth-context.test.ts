import type { Firestore } from "firebase-admin/firestore";
import { describe, expect, it } from "vitest";
import { makeCreateContext, type TokenVerifier } from "../../trpc/context";
import { appRouter } from "../../trpc/router";
import { createCallerFactory } from "../../trpc/trpc";
import { loadServerConfig } from "../config";

const config = loadServerConfig({ NODE_ENV: "test", FIRESTORE_DB: "test" } as NodeJS.ProcessEnv);
const firestore = {} as unknown as Firestore;
const verifyIdToken: TokenVerifier = async (token) => (token === "good" ? "user-1" : null);
const createContext = makeCreateContext({ firestore, config, verifyIdToken });
const createCaller = createCallerFactory(appRouter);

function requestWith(headers?: Record<string, string>): Request {
  return new Request("http://test.local/trpc", { headers });
}

describe("auth context", () => {
  it("yields uid null when no Authorization header is present", async () => {
    const ctx = await createContext({ req: requestWith() });
    expect(ctx.uid).toBeNull();
  });

  it("throws UNAUTHORIZED from a protected procedure when uid is null", async () => {
    const ctx = await createContext({ req: requestWith() });
    const caller = createCaller(ctx);
    await expect(caller.health.whoami()).rejects.toMatchObject({ code: "UNAUTHORIZED" });
  });

  it("resolves the uid from a valid bearer token and admits the protected call", async () => {
    const ctx = await createContext({ req: requestWith({ Authorization: "Bearer good" }) });
    expect(ctx.uid).toBe("user-1");
    const caller = createCaller(ctx);
    await expect(caller.health.whoami()).resolves.toEqual({ uid: "user-1" });
  });
});
