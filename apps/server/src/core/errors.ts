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

export type PartialCommitDetail = {
  /** records covered by the chunks that landed — the client sets its state from exactly these */
  writtenRows: number;
  writtenChunks: number;
  failedChunk: number;
  reason: string;
};

/** A chunked write that committed some chunks before failing. Retrying the whole payload is safe — the import skips what already landed. */
export class PartialCommitError extends Error {
  constructor(readonly detail: PartialCommitDetail) {
    super(
      `partial commit: ${detail.writtenChunks} chunk(s) written, chunk ${detail.failedChunk} failed: ${detail.reason}`,
    );
    this.name = "PartialCommitError";
  }
}

export function toPartialCommitError(detail: PartialCommitDetail): TRPCError {
  const cause = new PartialCommitError(detail);
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: cause.message, cause });
}
