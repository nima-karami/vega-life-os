import { describe, expect, it } from "vitest";
import {
  ACCESS_TOKEN_PREFIX,
  generateAccessToken,
  generateTokenId,
  hashAccessToken,
} from "../token-codec";

describe("access token codec", () => {
  it("generates a prefixed token of at least 52 characters", () => {
    const token = generateAccessToken();
    expect(token.startsWith(ACCESS_TOKEN_PREFIX)).toBe(true);
    expect(token.length).toBeGreaterThanOrEqual(52);
  });

  it("hashes with SHA-256 to lowercase hex", () => {
    expect(hashAccessToken("abc")).toBe(
      "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    );
  });

  it("generates a distinct token each time", () => {
    expect(generateAccessToken()).not.toBe(generateAccessToken());
  });

  it("generates a 10-character pat_ id", () => {
    expect(generateTokenId()).toMatch(/^pat_[A-Za-z0-9_-]{6}$/);
  });
});
