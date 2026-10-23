import { beforeEach, describe, expect, it, vi } from "vitest";

const { setDelegate, setPersistAuth, sandbox } = vi.hoisted(() => ({
  setDelegate: vi.fn(),
  setPersistAuth: vi.fn(),
  sandbox: { isDirty: false },
}));

vi.mock("@/core/firebase/app", () => ({ auth: null, firebaseEnabled: false }));
vi.mock("@/core/persistence", async (orig) => {
  const actual = await orig<typeof import("@/core/persistence")>();
  return {
    ...actual,
    persistence: { ...actual.persistence, clearAll: vi.fn(async () => {}), setDelegate },
    DexieAdapter: class {
      clearAll = vi.fn(async () => {});
      isEmpty = vi.fn(async () => false);
    },
  };
});
vi.mock("@/core/persistence/sandbox-meta", () => ({
  setSandboxDirty: vi.fn(async () => {}),
  getSandboxDirty: vi.fn(async () => sandbox.isDirty),
  isSandboxDirty: (dirty: boolean) => dirty,
}));
vi.mock("./persist", () => ({ setPersistAuth, bindPersistStore: vi.fn() }));

import { useStore } from "./store";

const bootstrap = vi.fn(async () => {});

describe("onAuthChange", () => {
  beforeEach(() => {
    setDelegate.mockClear();
    setPersistAuth.mockClear();
    bootstrap.mockClear();
    sandbox.isDirty = false;
    useStore.setState({
      authUid: null,
      authResolved: true,
      pendingSignIn: null,
      ready: false,
      loadFailed: false,
      bootstrap,
    });
  });

  it("parks a sign-in over a dirty sandbox without committing auth", async () => {
    sandbox.isDirty = true;
    await useStore.getState().onAuthChange("u1");
    const state = useStore.getState();
    expect(state.pendingSignIn).toBe("u1");
    expect(state.authUid).toBeNull();
    expect(setPersistAuth).not.toHaveBeenCalled();
    expect(setDelegate).not.toHaveBeenCalled();
  });

  it("commits a clean sign-in and loads the account", async () => {
    await useStore.getState().onAuthChange("u1");
    const state = useStore.getState();
    expect(state.authUid).toBe("u1");
    expect(setPersistAuth).toHaveBeenCalledWith("u1");
    expect(state).toMatchObject({ pendingSignIn: null, loadFailed: true, ready: true });
  });

  it("boots the local sandbox on an initial signed-out callback", async () => {
    useStore.setState({ authResolved: false });
    await useStore.getState().onAuthChange(null);
    expect(useStore.getState().authResolved).toBe(true);
    expect(setDelegate).toHaveBeenCalledOnce();
    expect(bootstrap).toHaveBeenCalledOnce();
  });

  it("commits auth and does nothing else on a noop", async () => {
    await useStore.getState().onAuthChange(null);
    expect(setPersistAuth).toHaveBeenCalledWith(null);
    expect(setDelegate).not.toHaveBeenCalled();
    expect(bootstrap).not.toHaveBeenCalled();
    expect(useStore.getState().ready).toBe(false);
  });

  it("resets to an empty, ready sandbox on sign-out", async () => {
    useStore.setState({ authUid: "u1", pendingSignIn: "u2", loadFailed: true, onboarded: true });
    await useStore.getState().onAuthChange(null);
    const state = useStore.getState();
    expect(setDelegate).toHaveBeenCalledOnce();
    expect(state).toMatchObject({
      authUid: null,
      pendingSignIn: null,
      loadFailed: false,
      ready: true,
      onboarded: false,
      tasks: [],
      values: [],
    });
    expect(state.operatorName).toBe("Operator");
  });
});
