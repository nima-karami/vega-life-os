import { describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({
  onAuth: vi.fn(),
  onAuthChange: vi.fn(async () => {}),
}));

vi.mock("@/core/auth", () => ({ onAuth: auth.onAuth }));
vi.mock("@/core/store", () => ({
  useStore: { getState: () => ({ onAuthChange: auth.onAuthChange }) },
}));

import { startAuthSync } from "../auth-sync";

describe("startAuthSync", () => {
  it("subscribes once however often it is called, and forwards each user's uid", () => {
    startAuthSync();
    startAuthSync();

    expect(auth.onAuth).toHaveBeenCalledTimes(1);
    const handleUser = auth.onAuth.mock.calls[0][0] as (user: { uid: string } | null) => void;
    handleUser({ uid: "account-a" });
    handleUser(null);

    expect(auth.onAuthChange.mock.calls).toEqual([["account-a"], [null]]);
  });
});
