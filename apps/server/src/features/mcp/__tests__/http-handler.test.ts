import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { Firestore } from "firebase-admin/firestore";
import { describe, expect, it, vi } from "vitest";
import type { AccessTokenResolver } from "../../access-tokens/grant";
import { handleMcpRequest, type McpHttpDeps } from "../http-handler";
import { MCP_COLLECTIONS } from "../mcp-collections";
import { registerReadTools } from "../read-tools";

const url = "http://localhost/mcp";

function createDeps(): McpHttpDeps {
  return {
    firestore: new Firestore({ projectId: "test" }),
    calendar: { scheduleReconcile: vi.fn() },
    corsOrigins: ["https://vega.example"],
    registrars: [],
    resolveAccessToken: vi.fn<AccessTokenResolver>(async (token) =>
      token === "valid"
        ? { uid: "owner", tokenId: "pat_test", scope: "read", timeZone: "UTC" }
        : null,
    ),
  };
}

function initializeRequest(body: string) {
  return new Request(url, {
    method: "POST",
    headers: {
      Authorization: "Bearer valid",
      Origin: "https://vega.example",
      Accept: "application/json, text/event-stream",
      "Content-Type": "application/json",
    },
    body,
  });
}

describe("handleMcpRequest", () => {
  it.each(["GET", "DELETE"])("answers %s with 405 and Allow", async (method) => {
    const deps = createDeps();
    const response = await handleMcpRequest(new Request(url, { method }), deps);
    expect(response.status).toBe(405);
    expect(response.headers.get("allow")).toBe("POST");
    expect(deps.resolveAccessToken).not.toHaveBeenCalled();
  });

  it("rejects a foreign origin", async () => {
    const request = new Request(url, { method: "POST", headers: { Origin: "https://other.test" } });
    expect((await handleMcpRequest(request, createDeps())).status).toBe(403);
  });

  it("rejects an excessive declared body size", async () => {
    const request = new Request(url, { method: "POST", headers: { "Content-Length": "1048577" } });
    expect((await handleMcpRequest(request, createDeps())).status).toBe(413);
  });

  it.each([
    {},
    { Authorization: "Bearer revoked" },
    { Authorization: "Bearer valid extra" },
  ])("challenges unauthenticated requests", async (headers) => {
    const response = await handleMcpRequest(
      new Request(url, { method: "POST", headers }),
      createDeps(),
    );
    expect(response.status).toBe(401);
    expect(response.headers.get("www-authenticate")).toBe('Bearer realm="vega"');
  });

  it("answers initialization for a valid grant", async () => {
    const request = initializeRequest(
      JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "initialize",
        params: {
          protocolVersion: "2025-11-25",
          capabilities: {},
          clientInfo: { name: "unit", version: "1" },
        },
      }),
    );
    const response = await handleMcpRequest(request, createDeps());
    expect(response.status).toBe(200);
    expect(response.headers.get("mcp-session-id")).toBeNull();
    expect(await response.json()).toMatchObject({ result: { serverInfo: { name: "vega" } } });
  });

  it("supports stateless SDK calls and describes every collection's create schema", async () => {
    const deps = { ...createDeps(), registrars: [registerReadTools] };
    const client = new Client({ name: "unit", version: "1" });
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    try {
      await client.connect(
        new StreamableHTTPClientTransport(new URL(url), {
          requestInit: { headers: { Authorization: "Bearer valid" } },
          fetch: (input, init) => handleMcpRequest(new Request(input, init), deps),
        }),
      );
      expect((await client.listTools()).tools).toHaveLength(5);
      for (const collection of MCP_COLLECTIONS) {
        const result = await client.callTool({
          name: "describe_collection",
          arguments: { collection },
        });
        expect(result.structuredContent, collection).toMatchObject({
          schema: { type: "object", required: expect.not.arrayContaining(["id"]) },
        });
      }
      expect(log).toHaveBeenCalledTimes(MCP_COLLECTIONS.length);
      expect(log).toHaveBeenCalledWith({
        uid: "owner",
        tokenId: "pat_test",
        tool: "describe_collection",
      });
    } finally {
      await client.close();
      log.mockRestore();
    }
  });

  it("lets the transport enforce the limit without Content-Length", async () => {
    const response = await handleMcpRequest(initializeRequest("x".repeat(1_048_577)), createDeps());
    expect(response.status).toBe(413);
  });
});
