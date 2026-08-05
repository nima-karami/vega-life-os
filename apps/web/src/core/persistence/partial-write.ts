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
export function toPartialWriteError(error: unknown): PartialWriteError | null {
  const detail = (error as { data?: { partialCommit?: PartialWriteDetail } } | null)?.data
    ?.partialCommit;
  return detail ? new PartialWriteError(detail) : null;
}
