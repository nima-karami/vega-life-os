import { describe, expect, it } from "vitest";
import { bootTestServer } from "../../test/harness";

/**
 * The boot guard (`assertDbMatchesEnv`) is wired into the real server entry (`index.ts`) and the
 * test harness alike: a non-prod env pointed at the prod `(default)` database must refuse to boot,
 * so a misconfigured deploy can never touch production data.
 */
describe("wrong-DB boot guard gates server startup", () => {
  it("refuses to boot under NODE_ENV=test against the prod (default) database", async () => {
    await expect(bootTestServer({ configOverride: { dbName: "(default)" } })).rejects.toThrow(
      /refuses.*prod/i,
    );
  });

  it("refuses to boot under NODE_ENV=staging against the prod (default) database", async () => {
    await expect(
      bootTestServer({ configOverride: { nodeEnv: "staging", dbName: "(default)" } }),
    ).rejects.toThrow(/refuses.*prod/i);
  });

  it("boots normally against a named non-prod database", async () => {
    const server = await bootTestServer({ configOverride: { nodeEnv: "test", dbName: "test" } });
    const res = await fetch(`${server.url}/health`);
    expect(res.status).toBe(200);
    await server.close();
  });
});
