import { google } from "googleapis";
import type { OauthConfig } from "../../core/config";

export const GCAL_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.calendarlist.readonly",
  "https://www.googleapis.com/auth/calendar.app.created",
];

/** Bump when GCAL_SCOPES changes so already-connected users are re-prompted for consent. */
export const SCOPE_VERSION = 1;

export type OauthTokens = {
  accessToken: string;
  refreshToken: string | null;
  expiresInSec: number;
};

/** A token-endpoint fault carrying the HTTP status the token store classifies (400 invalid_grant vs transient 5xx). */
export class OauthHttpError extends Error {
  constructor(
    readonly status: number,
    readonly reason: string,
  ) {
    super(`oauth ${status} ${reason}`);
    this.name = "OauthHttpError";
  }
}

/** The Google authorization-code + token-refresh surface — a real impl and a test mock satisfy it. */
export type OauthGateway = {
  buildConsentUrl(state: string): string;
  exchangeCode(code: string): Promise<OauthTokens>;
  refresh(refreshToken: string): Promise<OauthTokens>;
};

export function createOauthGateway(config: OauthConfig): OauthGateway {
  const client = () =>
    new google.auth.OAuth2(config.clientId, config.clientSecret, config.redirectUri);

  return {
    buildConsentUrl(state) {
      return client().generateAuthUrl({
        access_type: "offline",
        prompt: "consent",
        scope: GCAL_SCOPES,
        state,
      });
    },
    async exchangeCode(code) {
      try {
        const { tokens } = await client().getToken(code);
        return {
          accessToken: tokens.access_token ?? "",
          refreshToken: tokens.refresh_token ?? null,
          expiresInSec: expiresInSec(tokens.expiry_date),
        };
      } catch (error) {
        throw toOauthHttpError(error);
      }
    },
    async refresh(refreshToken) {
      const oauth = client();
      oauth.setCredentials({ refresh_token: refreshToken });
      try {
        const { credentials } = await oauth.refreshAccessToken();
        return {
          accessToken: credentials.access_token ?? "",
          refreshToken: credentials.refresh_token ?? refreshToken,
          expiresInSec: expiresInSec(credentials.expiry_date),
        };
      } catch (error) {
        throw toOauthHttpError(error);
      }
    },
  };
}

function expiresInSec(expiryDate: number | null | undefined): number {
  if (!expiryDate) return 3600;
  return Math.max(0, Math.round((expiryDate - Date.now()) / 1000));
}

function toOauthHttpError(error: unknown): OauthHttpError {
  const status = readNumber(error, "status") ?? readNumber(error, "code") ?? 500;
  const reason = readReason(error);
  return new OauthHttpError(status, reason);
}

function readNumber(error: unknown, key: string): number | null {
  if (typeof error !== "object" || error === null) return null;
  const value = (error as Record<string, unknown>)[key];
  return typeof value === "number" ? value : null;
}

function readReason(error: unknown): string {
  if (typeof error === "object" && error !== null && "message" in error) {
    const message = (error as { message: unknown }).message;
    if (typeof message === "string" && message.includes("invalid_grant")) return "invalid_grant";
  }
  return "error";
}
