import { randomUUID } from "node:crypto";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { afterAll, beforeAll, expect, it, vi } from "vitest";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { createAccessToken, revokeAccessToken } from "../../access-tokens/token-store";
import type { ToolRegistrar } from "../mcp-context";
import { registerReadTools } from "../read-tools";
import { toToolSuccess } from "../tool-result";

const now = "2026-11-21T02:30:00.000Z";
const today = "2026-11-20";
const owner = randomUUID();
const other = randomUUID();
const stubWriteTool = "stub_write";
let server: TestServer;

const registerStubWrite: ToolRegistrar = (mcpServer, { grant }) => {
  if (grant.scope === "read") return;
  mcpServer.registerTool(stubWriteTool, { inputSchema: {} }, () => toToolSuccess({ ok: true }));
};

beforeAll(async () => {
  server = await bootTestServer({
    now: () => now,
    useAdminVerifier: true,
    mcpRegistrars: [registerReadTools, registerStubWrite],
  });
});

afterAll(async () => {
  await server?.close();
});

async function mintToken(scope: "read" | "write") {
  return createAccessToken(
    server.firestore,
    owner,
    { name: "MCP integration", scope, timeZone: "America/Toronto" },
    now,
  );
}

async function connectClient(client: Client, token: string) {
  await client.connect(
    new StreamableHTTPClientTransport(new URL("/mcp", server.url), {
      requestInit: { headers: { Authorization: `Bearer ${token}` } },
    }),
  );
}

it("exposes the five read tools, scopes the write stub, and reads only the token owner's data", async () => {
  const [{ token: readToken }, { token: writeToken }] = await Promise.all([
    mintToken("read"),
    mintToken("write"),
  ]);
  const readClient = new Client({ name: "read-test", version: "1" });
  const writeClient = new Client({ name: "write-test", version: "1" });
  const log = vi.spyOn(console, "log");
  const error = vi.spyOn(console, "error");

  try {
    await Promise.all([
      server.firestore.doc(`users/${owner}/tasks/t_own`).set({
        id: "t_own",
        title: "Owner's walk",
        date: today,
        time: "10:30",
        kind: "oneoff",
        status: "todo",
        order: 0,
        updatedAt: now,
        fieldUpdatedAt: { date: now },
      }),
      server.firestore.doc(`users/${other}/tasks/t_other`).set({ id: "t_other", date: today }),
      server.firestore.doc(`users/${owner}`).set({ name: "Owner" }),
    ]);
    await connectClient(readClient, readToken);
    await connectClient(writeClient, writeToken);

    const { tools } = await readClient.listTools();
    expect(tools.map(({ name }) => name).sort()).toEqual([
      "describe_collection",
      "get_day",
      "get_overview",
      "get_record",
      "list_records",
    ]);
    expect(tools.every(({ annotations }) => annotations?.readOnlyHint)).toBe(true);
    expect((await writeClient.listTools()).tools.map(({ name }) => name)).toContain(stubWriteTool);
    await expect(readClient.callTool({ name: stubWriteTool })).resolves.toMatchObject({
      isError: true,
      content: [{ type: "text", text: expect.stringContaining("not found") }],
    });
    await expect(writeClient.callTool({ name: stubWriteTool })).resolves.toMatchObject({
      structuredContent: { ok: true },
    });

    const listed = await readClient.callTool({
      name: "list_records",
      arguments: { collection: "tasks" },
    });
    expect(listed).toMatchObject({
      structuredContent: { rows: [{ id: "t_own", updatedAt: now }], nextCursor: null },
    });
    expect(JSON.stringify(listed)).not.toContain("fieldUpdatedAt");
    await expect(readClient.callTool({ name: "get_day" })).resolves.toMatchObject({
      structuredContent: { date: today, tasks: { remaining: [{ id: "t_own" }] } },
    });
    await expect(readClient.callTool({ name: "get_overview" })).resolves.toMatchObject({
      structuredContent: { today, profileName: "Owner", counts: { tasks: 1, habits: 0 } },
    });
    await expect(
      readClient.callTool({
        name: "get_record",
        arguments: { collection: "tasks", id: "t_other" },
      }),
    ).resolves.toMatchObject({
      isError: true,
      structuredContent: { code: "NOT_FOUND" },
    });
    await expect(
      readClient.callTool({ name: "describe_collection", arguments: { collection: "cards" } }),
    ).resolves.toMatchObject({
      structuredContent: {
        idPrefix: "c_",
        writable: true,
        schema: { type: "object", required: expect.not.arrayContaining(["id"]) },
      },
    });
  } finally {
    try {
      await Promise.all([readClient.close(), writeClient.close()]);
      const logs = JSON.stringify([...log.mock.calls, ...error.mock.calls]);
      expect(logs.includes(readToken) || logs.includes(writeToken)).toBe(false);
    } finally {
      log.mockRestore();
      error.mockRestore();
    }
  }
});

it("rejects a PAT on tRPC and rejects revoked tokens on the next MCP request", async () => {
  const { token, row } = await mintToken("read");
  await expect(server.asUid(token).accessTokens.list.query()).rejects.toMatchObject({
    data: { code: "UNAUTHORIZED" },
  });
  const client = new Client({ name: "revoke-test", version: "1" });
  try {
    await connectClient(client, token);
    await revokeAccessToken(server.firestore, owner, row.id, now);
    const response = await fetch(`${server.url}/mcp`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    expect(response.status).toBe(401);
  } finally {
    await client.close();
  }
});
