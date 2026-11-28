import { ACCESS_TOKEN_LIMIT, type AccessTokenCreateInput } from "@vega/shared";
import { DocumentReference, type Firestore } from "firebase-admin/firestore";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { ACCESS_TOKEN_PREFIX, hashAccessToken } from "../token-codec";
import {
  createAccessToken,
  createAccessTokenResolver,
  listAccessTokens,
  revokeAccessToken,
} from "../token-store";

const CREATED_AT = "2026-11-20T12:00:00.000Z";
const TEN_MINUTES = 10 * 60 * 1000;

const readInput: AccessTokenCreateInput = {
  name: "Claude Desktop",
  scope: "read",
  timeZone: "America/Toronto",
};

async function createTokens(firestore: Firestore, uid: string, count: number) {
  const created = [];
  for (let index = 0; index < count; index += 1) {
    created.push(await createAccessToken(firestore, uid, readInput, CREATED_AT));
  }
  return created;
}

describe("access token store (emulator)", () => {
  let server: TestServer;
  let firestore: Firestore;

  beforeAll(async () => {
    server = await bootTestServer();
    firestore = server.firestore;
  });
  afterAll(async () => {
    await server.close();
  });

  it("resolves a created token to its grant", async () => {
    const created = await createAccessToken(
      firestore,
      "store-roundtrip",
      { ...readInput, scope: "write" },
      CREATED_AT,
    );
    const resolveToken = createAccessTokenResolver(firestore);

    await expect(resolveToken(created.token)).resolves.toEqual({
      uid: "store-roundtrip",
      tokenId: created.row.id,
      scope: "write",
      timeZone: "America/Toronto",
    });
  });

  it("never stores the plaintext token", async () => {
    const created = await createAccessToken(firestore, "store-plaintext", readInput, CREATED_AT);
    const snapshot = await firestore.doc(`accessTokens/${hashAccessToken(created.token)}`).get();

    expect(snapshot.exists).toBe(true);
    for (const value of Object.values(snapshot.data() ?? {})) {
      expect(String(value)).not.toContain(created.token);
    }
    expect(snapshot.id).not.toContain(created.token);
  });

  it("refuses a revoked token on the very next resolve", async () => {
    const uid = "store-revoke";
    const created = await createAccessToken(firestore, uid, readInput, CREATED_AT);
    const resolveToken = createAccessTokenResolver(firestore);
    await expect(resolveToken(created.token)).resolves.not.toBeNull();

    await revokeAccessToken(firestore, uid, created.row.id, CREATED_AT);

    await expect(resolveToken(created.token)).resolves.toBeNull();
  });

  it("refuses an unprefixed or unknown token", async () => {
    const resolveToken = createAccessTokenResolver(firestore);
    await expect(resolveToken("not-a-token")).resolves.toBeNull();
    await expect(resolveToken("vega_pat_unknown")).resolves.toBeNull();
  });

  it("refuses a token beyond the active limit", async () => {
    const uid = "store-limit";
    await createTokens(firestore, uid, ACCESS_TOKEN_LIMIT);

    await expect(createAccessToken(firestore, uid, readInput, CREATED_AT)).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "token limit reached: revoke one first",
    });
  });

  it("lets exactly one of two concurrent creates through at one below the limit", async () => {
    const uid = "store-race";
    await createTokens(firestore, uid, ACCESS_TOKEN_LIMIT - 1);

    const outcomes = await Promise.allSettled([
      createAccessToken(firestore, uid, readInput, CREATED_AT),
      createAccessToken(firestore, uid, readInput, CREATED_AT),
    ]);

    expect(outcomes.filter((outcome) => outcome.status === "fulfilled")).toHaveLength(1);
    const rejected = outcomes.find((outcome) => outcome.status === "rejected");
    expect(rejected?.status === "rejected" && rejected.reason).toMatchObject({
      code: "BAD_REQUEST",
    });
    expect(await listAccessTokens(firestore, uid)).toHaveLength(ACCESS_TOKEN_LIMIT);
  });

  it("refuses a name that contains a token", async () => {
    await expect(
      createAccessToken(
        firestore,
        "store-pasted",
        { ...readInput, name: `${ACCESS_TOKEN_PREFIX}abc` },
        CREATED_AT,
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });
  });

  it("refuses an invalid time zone", async () => {
    await expect(
      createAccessToken(
        firestore,
        "store-zone",
        { ...readInput, timeZone: "Mars/Olympus" },
        CREATED_AT,
      ),
    ).rejects.toMatchObject({ code: "BAD_REQUEST", message: "invalid time zone" });
  });

  it("lists only the uid's active tokens, newest first, without the hash", async () => {
    const uid = "store-list";
    const older = await createAccessToken(firestore, uid, readInput, "2026-11-20T10:00:00.000Z");
    const newer = await createAccessToken(firestore, uid, readInput, "2026-11-20T11:00:00.000Z");
    const revoked = await createAccessToken(firestore, uid, readInput, CREATED_AT);
    await revokeAccessToken(firestore, uid, revoked.row.id, CREATED_AT);
    await createAccessToken(firestore, "store-list-other", readInput, CREATED_AT);

    const rows = await listAccessTokens(firestore, uid);

    expect(rows).toEqual([newer.row, older.row]);
    expect(JSON.stringify(rows)).not.toContain(hashAccessToken(newer.token));
  });

  it("refuses to revoke another uid's token or a revoked one", async () => {
    const created = await createAccessToken(firestore, "store-owner", readInput, CREATED_AT);

    await expect(
      revokeAccessToken(firestore, "store-intruder", created.row.id, CREATED_AT),
    ).rejects.toMatchObject({ code: "NOT_FOUND", message: "token not found" });

    await revokeAccessToken(firestore, "store-owner", created.row.id, CREATED_AT);
    await expect(
      revokeAccessToken(firestore, "store-owner", created.row.id, CREATED_AT),
    ).rejects.toMatchObject({ code: "NOT_FOUND" });
  });

  it("writes lastUsedAt at most once per ten minutes", async () => {
    const created = await createAccessToken(firestore, "store-last-used", readInput, CREATED_AT);
    const tokenPath = `accessTokens/${hashAccessToken(created.token)}`;
    const updateSpy = vi.spyOn(DocumentReference.prototype, "update");
    const firstUse = Date.parse("2026-11-20T13:00:00.000Z");
    let clock = firstUse;
    const resolveToken = createAccessTokenResolver(firestore, () => clock);
    const countLastUsedWrites = () =>
      updateSpy.mock.contexts.filter((context) => (context as DocumentReference).path === tokenPath)
        .length;

    try {
      await resolveToken(created.token);
      await vi.waitFor(async () => {
        const snapshot = await firestore.doc(tokenPath).get();
        expect(snapshot.get("lastUsedAt")).toBe(new Date(firstUse).toISOString());
      });
      clock = firstUse + TEN_MINUTES - 1000;
      await resolveToken(created.token);
      expect(countLastUsedWrites()).toBe(1);

      clock = firstUse + TEN_MINUTES + 1000;
      await resolveToken(created.token);
      expect(countLastUsedWrites()).toBe(2);
    } finally {
      updateSpy.mockRestore();
    }
  });
});
