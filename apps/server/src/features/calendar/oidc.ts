import { auth } from "@googleapis/calendar";
import type { OidcVerifier } from "../../app";

/** Verify a Cloud Scheduler OIDC token against the reconcile endpoint audience. */
export function createOidcVerifier(audience: string): OidcVerifier {
  const client = new auth.OAuth2();
  return async (token) => {
    if (!token) return false;
    try {
      await client.verifyIdToken({ idToken: token, audience });
      return true;
    } catch {
      return false;
    }
  };
}
