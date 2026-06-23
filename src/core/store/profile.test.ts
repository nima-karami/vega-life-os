import { describe, expect, it } from "vitest";
import { profileIncomplete, resolveProfile } from "./profile";

describe("resolveProfile", () => {
  it("prefers a non-empty cloud value over the auth account", () => {
    const r = resolveProfile(
      { name: "Custom Name", workspace: "Studio", avatar: "data:cloud" },
      { displayName: "Google Name", email: "me@x.com", photoURL: "https://photo" },
    );
    expect(r).toEqual({
      name: "Custom Name",
      email: "me@x.com",
      avatar: "data:cloud",
      workspace: "Studio",
    });
  });

  it("falls back to the auth account when cloud is empty", () => {
    const r = resolveProfile(null, {
      displayName: "Google Name",
      email: "me@x.com",
      photoURL: "https://photo",
    });
    expect(r).toEqual({
      name: "Google Name",
      email: "me@x.com",
      avatar: "https://photo",
      workspace: "Personal workspace",
    });
  });

  it("leaves name empty when neither cloud nor auth supply one (email sign-up)", () => {
    const r = resolveProfile(null, { displayName: null, email: "me@x.com", photoURL: null });
    expect(r.name).toBe("");
    expect(r.email).toBe("me@x.com");
    expect(r.avatar).toBe("");
    expect(r.workspace).toBe("Personal workspace");
  });

  it("email always comes from auth, never from the cloud profile", () => {
    const r = resolveProfile(
      { name: "C" },
      { displayName: null, email: "auth@x.com", photoURL: null },
    );
    expect(r.email).toBe("auth@x.com");
  });

  it("treats whitespace-only cloud values as empty", () => {
    const r = resolveProfile(
      { name: "   ", workspace: "  " },
      { displayName: "Fallback", email: null, photoURL: null },
    );
    expect(r.name).toBe("Fallback");
    expect(r.workspace).toBe("Personal workspace");
  });

  it("returns safe defaults when both inputs are null", () => {
    expect(resolveProfile(null, null)).toEqual({
      name: "",
      email: "",
      avatar: "",
      workspace: "Personal workspace",
    });
  });
});

describe("profileIncomplete", () => {
  it("is true for empty, whitespace, or the default 'Operator'", () => {
    expect(profileIncomplete("")).toBe(true);
    expect(profileIncomplete("   ")).toBe(true);
    expect(profileIncomplete("Operator")).toBe(true);
  });

  it("is false once a real name is set", () => {
    expect(profileIncomplete("Nima")).toBe(false);
    expect(profileIncomplete("  Nima  ")).toBe(false);
  });
});
