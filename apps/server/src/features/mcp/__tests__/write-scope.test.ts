import { describe, expect, it } from "vitest";
import { assertWriteScope } from "../write-tools";

const grant = { uid: "u1", tokenId: "pat_1", timeZone: "America/Toronto" };

describe("assertWriteScope", () => {
  it("refuses a read grant as FORBIDDEN", () => {
    expect(() => assertWriteScope({ ...grant, scope: "read" })).toThrow(
      expect.objectContaining({ code: "FORBIDDEN" }),
    );
  });

  it("lets a write grant through", () => {
    expect(() => assertWriteScope({ ...grant, scope: "write" })).not.toThrow();
  });
});
