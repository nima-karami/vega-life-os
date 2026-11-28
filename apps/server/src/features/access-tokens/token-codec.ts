import { createHash, randomBytes } from "node:crypto";

export const ACCESS_TOKEN_PREFIX = "vega_pat_";

export function generateAccessToken(): string {
  return ACCESS_TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

export function hashAccessToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export function generateTokenId(): string {
  return `pat_${randomBytes(8).toString("base64url")}`.slice(0, 10);
}
