import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { Firestore } from "firebase-admin/firestore";
import type { CalendarContext } from "../../trpc/context";
import type { AccessTokenGrant } from "../access-tokens/grant";

/** "Now" seen from the token owner's time zone — the server's own zone never leaks into a write. */
export type McpClock = {
  today: string;
  nowLocal: string;
  nowIso: string;
  /** Local fields read today at 12:00 in the token zone: a DST-safe date-only reference. */
  noonDate: Date;
  dayOf: (instantIso: string) => string;
};

export type McpContext = {
  grant: AccessTokenGrant;
  firestore: Firestore;
  calendar: Pick<CalendarContext, "scheduleReconcile">;
  clock: () => McpClock;
};

export type ToolRegistrar = (server: McpServer, context: McpContext) => void;
