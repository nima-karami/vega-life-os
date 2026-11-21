// @vitest-environment jsdom
import type { AccessTokenCreated, AccessTokenRow } from "@vega/shared";
import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { useAccessTokens } from "../useAccessTokens";

type Deferred<T> = { resolve: (value: T) => void; reject: (reason: unknown) => void };

const held = vi.hoisted(() => ({
  lists: [] as Deferred<AccessTokenRow[]>[],
  creates: [] as Deferred<AccessTokenCreated>[],
  revokes: [] as Deferred<void>[],
}));

const hold = <T>(queue: Deferred<T>[]) =>
  new Promise<T>((resolve, reject) => queue.push({ resolve, reject }));

vi.mock("@/core/persistence/trpc-client", () => ({
  getTrpcClient: () => ({
    accessTokens: {
      list: { query: () => hold(held.lists) },
      create: { mutate: () => hold(held.creates) },
      revoke: { mutate: () => hold(held.revokes) },
    },
  }),
}));

const buildRow = (id: string, name = id): AccessTokenRow => ({
  id,
  name,
  scope: "read",
  timeZone: "America/Toronto",
  createdAt: "2026-11-20T15:00:00.000Z",
  lastUsedAt: null,
});

let container: HTMLDivElement;
let root: Root;
let tokens: ReturnType<typeof useAccessTokens>;

function Probe() {
  tokens = useAccessTokens();
  return null;
}

const settle = async () => {
  await act(async () => {
    for (let pass = 0; pass < 4; pass += 1) await Promise.resolve();
  });
};

const resolveList = async (rows: AccessTokenRow[], index = held.lists.length - 1) => {
  held.lists[index].resolve(rows);
  await settle();
};

beforeEach(async () => {
  held.lists.length = 0;
  held.creates.length = 0;
  held.revokes.length = 0;
  container = document.createElement("div");
  document.body.append(container);
  root = createRoot(container);
  await act(async () => {
    root.render(createElement(Probe));
  });
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
});

describe("useAccessTokens", () => {
  it("loads the rows and turns ready", async () => {
    expect(tokens.status).toBe("loading");
    await resolveList([buildRow("pat_a")]);
    expect(tokens.status).toBe("ready");
    expect(tokens.tokens.map((row) => row.id)).toEqual(["pat_a"]);
  });

  it("shows the error state when the first load fails", async () => {
    held.lists[0].reject(new Error("offline"));
    await settle();
    expect(tokens.status).toBe("error");
  });

  it("adds a minted token before the background refresh returns, and returns its secret", async () => {
    await resolveList([buildRow("pat_a")]);
    let created: AccessTokenCreated | undefined;
    const pending = act(async () => {
      created = await tokens.create({ name: "New", scope: "write", timeZone: "America/Toronto" });
    });
    held.creates[0].resolve({ token: "vega_pat_secret", row: buildRow("pat_b", "New") });
    await pending;
    expect(created?.token).toBe("vega_pat_secret");
    expect(tokens.tokens.map((row) => row.id)).toEqual(["pat_b", "pat_a"]);
    expect(held.lists).toHaveLength(2);
  });

  it("keeps the loaded rows when a background refresh fails", async () => {
    await resolveList([buildRow("pat_a")]);
    await act(async () => {
      void tokens.reload();
    });
    held.lists[1].reject(new Error("offline"));
    await settle();
    expect(tokens.status).toBe("ready");
    expect(tokens.tokens.map((row) => row.id)).toEqual(["pat_a"]);
  });

  it("removes a revoked row without waiting for the refresh", async () => {
    await resolveList([buildRow("pat_a"), buildRow("pat_b")]);
    const pending = act(async () => {
      await tokens.revoke("pat_a");
    });
    held.revokes[0].resolve();
    await pending;
    expect(tokens.tokens.map((row) => row.id)).toEqual(["pat_b"]);
  });

  it("drops a superseded list result", async () => {
    await act(async () => {
      void tokens.reload();
    });
    await resolveList([buildRow("pat_new")], 1);
    await resolveList([buildRow("pat_old")], 0);
    expect(tokens.tokens.map((row) => row.id)).toEqual(["pat_new"]);
  });
});
