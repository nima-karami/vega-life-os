import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { ZodError } from "zod";
import { AppError, type AppErrorCode } from "../../core/errors";
import { ToolError, type ToolErrorCode } from "../../core/tool-error";

const APP_TO_TOOL_CODE: Record<AppErrorCode, ToolErrorCode> = {
  UNAUTHORIZED: "FORBIDDEN",
  BAD_REQUEST: "BAD_REQUEST",
  NOT_FOUND: "NOT_FOUND",
  CONFLICT: "CONFLICT",
  INTERNAL_SERVER_ERROR: "INTERNAL",
};

function toPayloadResult(payload: Record<string, unknown>, isError: boolean): CallToolResult {
  return {
    content: [{ type: "text", text: JSON.stringify(payload) }],
    structuredContent: payload,
    ...(isError ? { isError: true } : {}),
  };
}

export function toToolSuccess(payload: Record<string, unknown>): CallToolResult {
  return toPayloadResult(payload, false);
}

function formatZodIssues(error: ZodError): string {
  return error.issues
    .map((issue) => `${issue.path.join(".") || "(root)"}: ${issue.message}`)
    .join("\n");
}

function describeFailure(error: unknown): Record<string, unknown> {
  if (error instanceof ToolError)
    return { code: error.code, message: error.message, ...error.detail };
  if (error instanceof AppError)
    return { code: APP_TO_TOOL_CODE[error.code], message: error.message };
  if (error instanceof ZodError) return { code: "BAD_REQUEST", message: formatZodIssues(error) };
  console.error("mcp tool failed", error instanceof Error ? error.message : "unknown error");
  return { code: "INTERNAL", message: "internal error" };
}

export function toToolFailure(error: unknown): CallToolResult {
  return toPayloadResult(describeFailure(error), true);
}
