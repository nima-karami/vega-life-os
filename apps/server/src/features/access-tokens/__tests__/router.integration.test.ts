import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootTestServer, type TestServer } from "../../../test/harness";

describe("accessTokens router (real server vs emulator)", () => {
  let server: TestServer;
  const owner = "access-router-owner";

  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("creates, lists and revokes a token for the signed-in uid", async () => {
    const client = server.asUid(owner);
    const created = await client.accessTokens.create.mutate({
      name: "Claude Desktop",
      scope: "read",
      timeZone: "America/Toronto",
    });
    expect(created.token.startsWith("vega_pat_")).toBe(true);

    const listed = await client.accessTokens.list.query();
    expect(listed).toContainEqual(created.row);
    expect(JSON.stringify(listed)).not.toContain(created.token);

    await expect(client.accessTokens.revoke.mutate({ id: created.row.id })).resolves.toEqual({
      ok: true,
    });
    const afterRevoke = await client.accessTokens.list.query();
    expect(afterRevoke.map((row) => row.id)).not.toContain(created.row.id);
  });

  it("maps a store refusal to its tRPC code", async () => {
    await expect(
      server.asUid(owner).accessTokens.revoke.mutate({ id: "pat_unknown" }),
    ).rejects.toMatchObject({ data: { code: "NOT_FOUND" } });
  });

  it("rejects an unauthenticated call with UNAUTHORIZED", async () => {
    await expect(server.call.accessTokens.list.query()).rejects.toMatchObject({
      data: { code: "UNAUTHORIZED" },
    });
  });
});
