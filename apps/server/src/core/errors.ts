import { TRPCError } from "@trpc/server";

export type AppErrorCode =
  | "UNAUTHORIZED"
  | "BAD_REQUEST"
  | "NOT_FOUND"
  | "CONFLICT"
  | "INTERNAL_SERVER_ERROR";

export class AppError extends Error {
  constructor(
    readonly code: AppErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export function toTrpcError(error: AppError): TRPCError {
  return new TRPCError({ code: error.code, message: error.message });
}
