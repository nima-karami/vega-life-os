import { describe, expect, it } from "vitest";
import { authTransition } from "./auth-transition";

describe("authTransition", () => {
  it("first resolution → initial-sandbox / initial-account", () => {
    expect(authTransition(null, null, false)).toBe("initial-sandbox");
    expect(authTransition(null, "u1", false)).toBe("initial-account");
  });
  it("after resolution, null→uid is sign-in, uid→null is sign-out", () => {
    expect(authTransition(null, "u1", true)).toBe("sign-in");
    expect(authTransition("u1", null, true)).toBe("sign-out");
  });
  it("uid→different uid is switch-account", () => {
    expect(authTransition("u1", "u2", true)).toBe("switch-account");
  });
  it("unchanged state is noop", () => {
    expect(authTransition("u1", "u1", true)).toBe("noop");
    expect(authTransition(null, null, true)).toBe("noop");
  });
});
