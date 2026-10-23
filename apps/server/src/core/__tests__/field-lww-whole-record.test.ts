import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { taskInput } from "../../test/calendar-fixtures";
import { bootTestServer, type TestServer } from "../../test/harness";
import { createRepository } from "../repository";

/**
 * Two-session (two-device) whole-record LWW through the real tRPC upsert path. Each "device"
 * transmits a WHOLE record; the server re-stamps only the fields whose value differs from the
 * stored one, so a field a device leaves untouched keeps both its value and its timestamp.
 */
describe("two-device field-level LWW (whole-record upserts via separate sessions)", () => {
  let server: TestServer;
  const uid = "u-two-device";

  beforeAll(async () => {
    server = await bootTestServer();
  });
  afterAll(async () => {
    await server.close();
  });

  it("a second device editing a different field preserves the first device's untouched field + its stamp", async () => {
    const deviceA = server.asUid(uid);
    const deviceB = server.asUid(uid);
    const id = "t-fields";

    const stored = createRepository(server.firestore, uid, "tasks");
    await deviceA.tasks.upsert.mutate(taskInput(id, { title: "A", note: "n0" }));
    await deviceA.tasks.upsert.mutate(taskInput(id, { title: "B", note: "n0" }));
    const afterA = await stored.get(id);

    // Device B read A's result (title "B") and changes only `note`.
    const response = await deviceB.tasks.upsert.mutate(taskInput(id, { title: "B", note: "n1" }));
    const afterB = await stored.get(id);

    expect(response.title).toBe("B");
    expect(response.note).toBe("n1");
    expect(response).not.toHaveProperty("fieldUpdatedAt");
    // `title` was unchanged by B, so neither its value nor its timestamp moved.
    expect(afterB?.fieldUpdatedAt.title).toBe(afterA?.fieldUpdatedAt.title);
    expect(afterB?.fieldUpdatedAt.note).not.toBe(afterA?.fieldUpdatedAt.note);
  });

  it("KNOWN LIMITATION: a stale device's whole-record write reverts a field another device just changed", async () => {
    const deviceA = server.asUid(uid);
    const staleDevice = server.asUid(uid);
    const id = "t-stale";

    await deviceA.tasks.upsert.mutate(taskInput(id, { title: "A", note: "n0" }));
    await deviceA.tasks.upsert.mutate(taskInput(id, { title: "B", note: "n0" }));

    // The stale device never saw title "B"; its whole record still carries the old "A".
    const afterStale = await staleDevice.tasks.upsert.mutate(
      taskInput(id, { title: "A", note: "n1" }),
    );

    // The boundary the client-sends-a-whole-record protocol cannot close without last-observed
    // per-field times: A's title edit is reverted. Pinned by a test so the limitation is honest.
    expect(afterStale.title).toBe("A");
    expect(afterStale.note).toBe("n1");
  });
});
