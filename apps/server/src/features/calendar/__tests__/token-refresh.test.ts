import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootTestServer, type TestServer } from "../../../test/harness";
import {
  decryptSecret,
  encryptSecret,
  readGcalAccount,
  refreshAccessToken,
  storeConnection,
  TokenRevokedError,
  TransientTokenError,
} from "../token-store";

describe("gcal token store (real server vs emulator + mocked Google)", () => {
  let server: TestServer;
  const tokenDeps = () => ({
    firestore: server.firestore,
    gateway: server.google.gateway,
    config: server.config,
  });

  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("round-trips a refresh token through AES-256-GCM at rest", () => {
    const key = server.config.oauth.tokenEncryptionKey;
    const cipher = encryptSecret("refresh-secret-value", key);
    expect(cipher).not.toContain("refresh-secret-value");
    expect(decryptSecret(cipher, key)).toBe("refresh-secret-value");
  });

  it("silently mints a fresh access token from a stored refresh token", async () => {
    await connect("u-refresh");
    const token = await refreshAccessToken(tokenDeps(), "u-refresh");
    expect(token).toMatch(/^access-/);
  });

  it("classifies a 503 as transient (retry, no reconnect prompt)", async () => {
    await connect("u-transient");
    server.google.setRefreshBehavior("transient");
    await expect(refreshAccessToken(tokenDeps(), "u-transient")).rejects.toBeInstanceOf(
      TransientTokenError,
    );
    const account = await readGcalAccount(server.firestore, "u-transient");
    expect(account?.needsReauth).toBe(false);
    server.google.setRefreshBehavior("ok");
  });

  it("classifies invalid_grant as revoked → needs reauth exactly once", async () => {
    await connect("u-revoked");
    server.google.setRefreshBehavior("revoked");
    await expect(refreshAccessToken(tokenDeps(), "u-revoked")).rejects.toBeInstanceOf(
      TokenRevokedError,
    );
    const account = await readGcalAccount(server.firestore, "u-revoked");
    expect(account?.needsReauth).toBe(true);
    server.google.setRefreshBehavior("ok");
  });

  async function connect(uid: string): Promise<void> {
    await storeConnection(
      server.firestore,
      uid,
      `refresh-${uid}`,
      server.config.oauth.tokenEncryptionKey,
      { connectedAt: server.now(), scopeVersion: 1 },
    );
  }
});
