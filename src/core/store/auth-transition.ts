export type AuthTransition =
  | "initial-sandbox"
  | "initial-account"
  | "sign-in"
  | "sign-out"
  | "switch-account"
  | "noop";

/**
 * Classify an auth-state change so the store can tell *initial boot* apart from
 * a real *sign-in / sign-out* transition. `resolved` is false until the first
 * auth callback has been handled — critical so we never run sign-out cleanup
 * (which clears the device) on an initial signed-out boot.
 */
export function authTransition(
  prev: string | null,
  next: string | null,
  resolved: boolean,
): AuthTransition {
  if (!resolved) return next ? "initial-account" : "initial-sandbox";
  if (!prev && next) return "sign-in";
  if (prev && !next) return "sign-out";
  if (prev && next && prev !== next) return "switch-account";
  return "noop";
}
