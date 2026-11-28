import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { McpContext, ToolRegistrar } from "./mcp-context";

export function buildMcpServer(
  context: McpContext,
  registrars: readonly ToolRegistrar[],
): McpServer {
  const server = new McpServer({ name: "vega", version: process.env.APP_VERSION || "dev" });
  for (const register of registrars) register(server, context);
  return server;
}
