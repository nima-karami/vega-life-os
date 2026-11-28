import { z } from "zod";

export const ACCESS_TOKEN_LIMIT = 10;

export const accessTokenScopeSchema = z.enum(["read", "write"]);
export type AccessTokenScope = z.infer<typeof accessTokenScopeSchema>;

export const accessTokenCreateInputSchema = z
  .object({
    name: z.string().trim().min(1).max(60),
    scope: accessTokenScopeSchema,
    timeZone: z.string().min(1).max(64),
  })
  .strict();
export type AccessTokenCreateInput = z.infer<typeof accessTokenCreateInputSchema>;

export const accessTokenRevokeInputSchema = z.object({ id: z.string().min(1).max(32) }).strict();
export type AccessTokenRevokeInput = z.infer<typeof accessTokenRevokeInputSchema>;

/** A token as the owner sees it: never the secret or its hash. */
export type AccessTokenRow = {
  id: string;
  name: string;
  scope: AccessTokenScope;
  timeZone: string;
  createdAt: string;
  lastUsedAt: string | null;
};

/** The one response that carries the plaintext token; it is never retrievable again. */
export type AccessTokenCreated = { token: string; row: AccessTokenRow };
