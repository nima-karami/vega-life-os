export type ToolErrorCode =
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "CONFLICT"
  | "FORBIDDEN"
  | "CONFIRM_REQUIRED"
  | "INTERNAL";

export class ToolError extends Error {
  constructor(
    readonly code: ToolErrorCode,
    message: string,
    readonly detail?: Record<string, unknown>,
  ) {
    super(message);
    this.name = "ToolError";
  }
}
