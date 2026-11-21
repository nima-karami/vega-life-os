import type { AccessTokenScope } from "@vega/shared";

/** What a valid personal access token entitles its bearer to. */
export type AccessTokenGrant = {
  uid: string;
  tokenId: string;
  scope: AccessTokenScope;
  timeZone: string;
};

export type AccessTokenResolver = (token: string) => Promise<AccessTokenGrant | null>;
