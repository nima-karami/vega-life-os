/** What a chunked bulk write left behind when some chunks landed and one was rejected. */
export interface PartialWriteDetail {
  writtenRows: number;
  writtenChunks: number;
  failedChunk: number;
}

export class PartialWriteError extends Error {
  constructor(readonly detail: PartialWriteDetail) {
    super(
      `partial write: ${detail.writtenRows} row(s) landed, chunk ${detail.failedChunk} rejected`,
    );
    this.name = "PartialWriteError";
  }
}

/** The server reports a partial commit in the error's `data`; anything else lost the whole call. */
function toPartialWriteError(error: unknown): PartialWriteError | null {
  const detail = (error as { data?: { partialCommit?: PartialWriteDetail } } | null)?.data
    ?.partialCommit;
  return detail ? new PartialWriteError(detail) : null;
}

/** Run a chunked bulk call, re-raising a server-side partial commit as the client's own error type. */
export async function rethrowPartialWrites<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    const partial = toPartialWriteError(error);
    if (partial) throw partial;
    throw error;
  }
}
