import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import type { Firestore } from "firebase-admin/firestore";
import { readBearerToken } from "../../core/http";
import type { CalendarContext } from "../../trpc/context";
import type { AccessTokenResolver } from "../access-tokens/grant";
import type { ToolRegistrar } from "./mcp-context";
import { buildMcpServer } from "./mcp-server";
import { computeZonedClock } from "./zoned-clock";

const MAX_REQUEST_BODY_SIZE = 1_048_576;

export type McpHttpDeps = {
  resolveAccessToken: AccessTokenResolver;
  firestore: Firestore;
  calendar: Pick<CalendarContext, "scheduleReconcile">;
  registrars: readonly ToolRegistrar[];
  corsOrigins: readonly string[];
  now?: () => number;
};

export async function handleMcpRequest(request: Request, deps: McpHttpDeps): Promise<Response> {
  if (request.method !== "POST") {
    return new Response(null, { status: 405, headers: { Allow: "POST" } });
  }

  const origin = request.headers.get("Origin");
  if (origin !== null && !deps.corsOrigins.includes(origin)) {
    return new Response(null, { status: 403 });
  }

  if (Number(request.headers.get("Content-Length")) > MAX_REQUEST_BODY_SIZE) {
    return new Response(null, { status: 413 });
  }

  const token = readBearerToken(request);
  const grant = token ? await deps.resolveAccessToken(token) : null;
  if (!grant) {
    return new Response(null, {
      status: 401,
      headers: { "WWW-Authenticate": 'Bearer realm="vega"' },
    });
  }

  const server = buildMcpServer(
    {
      grant,
      firestore: deps.firestore,
      calendar: deps.calendar,
      clock: () => computeZonedClock(grant.timeZone ?? "", (deps.now ?? Date.now)()),
    },
    deps.registrars,
  );
  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    enableJsonResponse: true,
    maxRequestBodySize: MAX_REQUEST_BODY_SIZE,
  });
  try {
    await server.connect(transport);
    return await transport.handleRequest(request);
  } finally {
    try {
      await server.close();
    } finally {
      await transport.close();
    }
  }
}
