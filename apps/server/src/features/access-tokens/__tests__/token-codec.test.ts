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

  it("hashes stably to 64 hex characters", () => {
    const token = generateAccessToken();
    expect(hashAccessToken(token)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashAccessToken(token)).toBe(hashAccessToken(token));
  });

  it("generates a distinct token each time", () => {
    expect(generateAccessToken()).not.toBe(generateAccessToken());
  });

  it("generates a 10-character pat_ id", () => {
    expect(generateTokenId()).toMatch(/^pat_[A-Za-z0-9_-]{6}$/);
  });
});
