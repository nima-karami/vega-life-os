import { SCHEMA_HASH } from "@vega/shared";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { createRepository, type WritableEntity } from "../../core/repository";
import { bootTestServer, type TestServer } from "../harness";

let server: TestServer;

beforeAll(async () => {
  server = await bootTestServer();
});

afterAll(async () => {
  await server.close();
});

function sampleTask(id: string): WritableEntity<"tasks"> {
  return {
    id,
    title: "Harness task",
    kind: "oneoff",
    habitId: null,
    goalId: null,
    valueId: null,
    date: null,
    time: null,
    durationMin: 30,
    status: "open",
    detached: false,
    note: "",
    order: 0,
  };
}

describe("runtime harness (real server vs Firestore emulator)", () => {
  it("serves GET /health with the release version, build sha and shared schema hash", async () => {
    vi.stubEnv("GIT_SHA", "abc1234");
    vi.stubEnv("APP_VERSION", "v2026.10.1");
    try {
      const res = await fetch(`${server.url}/health`);
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({
        ok: true,
        version: "v2026.10.1",
        sha: "abc1234",
        schemaHash: SCHEMA_HASH,
      });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("reports version and sha dev when the image was built without them", async () => {
    vi.stubEnv("GIT_SHA", undefined);
    vi.stubEnv("APP_VERSION", "");
    try {
      const res = await fetch(`${server.url}/health`);
      expect(await res.json()).toMatchObject({ version: "dev", sha: "dev" });
    } finally {
      vi.unstubAllEnvs();
    }
  });

  it("resolves the uid for a signed request to health.whoami", async () => {
    const result = await server.asUid("u1").health.whoami.query();
    expect(result).toEqual({ uid: "u1" });
  });

  it("rejects an unauthenticated protected call with UNAUTHORIZED", async () => {
    await expect(server.call.health.whoami.query()).rejects.toMatchObject({
      data: { code: "UNAUTHORIZED" },
    });
  });

  it("round-trips a record through the uid-scoped repository", async () => {
    const tasks = createRepository(server.firestore, "harness-user", "tasks");
    const created = await tasks.upsert(sampleTask("h1"));
    expect(typeof created.updatedAt).toBe("string");
    expect(created.fieldUpdatedAt.title).toBe(created.updatedAt);

    expect((await tasks.list()).map((task) => task.id)).toContain("h1");

    await tasks.remove("h1");
    expect(await tasks.get("h1")).toBeNull();
  });

  it("scopes repository reads to the owning uid", async () => {
    const owner = createRepository(server.firestore, "owner-a", "tasks");
    const other = createRepository(server.firestore, "owner-b", "tasks");
    await owner.upsert(sampleTask("scoped-1"));
    expect((await other.list()).map((task) => task.id)).not.toContain("scoped-1");
  });
});
