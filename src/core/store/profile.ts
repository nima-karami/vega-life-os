import type { CloudProfile } from "@/core/firebase/profile";

export interface ResolvedProfile {
  name: string;
  email: string;
  avatar: string;
  workspace: string;
}

interface AuthLike {
  displayName: string | null;
  email: string | null;
  photoURL: string | null;
}

/** Cloud value wins when set; otherwise fall back to the auth account, then a default. */
export function resolveProfile(cloud: CloudProfile | null, user: AuthLike | null): ResolvedProfile {
  return {
    name: cloud?.name?.trim() || user?.displayName?.trim() || "",
    email: user?.email ?? "",
    avatar: cloud?.avatar?.trim() || user?.photoURL?.trim() || "",
    workspace: cloud?.workspace?.trim() || "Personal workspace",
  };
}

/** Signed-in user has no real display name yet ("Operator" is the unset default). */
export function profileIncomplete(name: string): boolean {
  const n = name.trim();
  return n === "" || n === "Operator";
}
