import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRepository } from "../core/repository";
import { type AppClient, bootTestServer, type TestServer } from "./harness";
import { type RoutedCollection, sampleByCollection } from "./samples";

type StoredMeta = { id: string; updatedAt: string; fieldUpdatedAt: Record<string, string> };

type DomainClient = {
  list: { query: () => Promise<StoredMeta[]> };
  get: { query: (input: { id: string }) => Promise<StoredMeta | null> };
  upsert: { mutate: (input: unknown) => Promise<StoredMeta> };
  delete: { mutate: (input: { id: string }) => Promise<{ id: string }> };
};

function domainOf(client: AppClient, collection: RoutedCollection): DomainClient {
  return (client as unknown as Record<string, DomainClient>)[collection];
}

/** The uid-scoped CRUD contract every domain router must satisfy, driven against the emulator. */
export function runCrudContract(collection: RoutedCollection): void {
  const sample = sampleByCollection[collection];
  const owner = `${collection}-owner`;
  const stranger = `${collection}-stranger`;

  describe(`${collection} router (real server vs emulator)`, () => {
    let server: TestServer;

    beforeAll(async () => {
      server = await bootTestServer();
    });
    afterAll(async () => {
      await server.close();
    });

    it("upsert returns the persisted record with server-stamped updatedAt + fieldUpdatedAt", async () => {
      const record = sample(`${collection}-a`);
      const persisted = await domainOf(server.asUid(owner), collection).upsert.mutate(record);
      expect(persisted.id).toBe(record.id);
      expect(typeof persisted.updatedAt).toBe("string");
      expect(persisted.fieldUpdatedAt.id).toBe(persisted.updatedAt);

      const fetched = await domainOf(server.asUid(owner), collection).get.query({ id: record.id });
      expect(fetched?.id).toBe(record.id);
    });

    it("a replayed identical upsert yields exactly one document", async () => {
      const record = sample(`${collection}-idem`);
      const first = await domainOf(server.asUid(owner), collection).upsert.mutate(record);
      const second = await domainOf(server.asUid(owner), collection).upsert.mutate(record);
      expect(second).toEqual(first);

      const ids = (await domainOf(server.asUid(owner), collection).list.query()).map((r) => r.id);
      expect(ids.filter((id) => id === record.id)).toHaveLength(1);
    });

    it("scopes list to the owning uid", async () => {
      const record = sample(`${collection}-scoped`);
      await domainOf(server.asUid(owner), collection).upsert.mutate(record);
      const strangerIds = (await domainOf(server.asUid(stranger), collection).list.query()).map(
        (r) => r.id,
      );
      expect(strangerIds).not.toContain(record.id);
    });

    it("delete removes the record", async () => {
      const record = sample(`${collection}-del`);
      await domainOf(server.asUid(owner), collection).upsert.mutate(record);
      await domainOf(server.asUid(owner), collection).delete.mutate({ id: record.id });
      expect(
        await domainOf(server.asUid(owner), collection).get.query({ id: record.id }),
      ).toBeNull();
    });

    it("strips an unknown field rather than rejecting (clients round-trip stored records)", async () => {
      const withExtra = { ...sample(`${collection}-extra`), unexpectedField: "x" };
      const persisted = await domainOf(server.asUid(owner), collection).upsert.mutate(withExtra);
      expect(persisted.id).toBe(`${collection}-extra`);
      expect(persisted).not.toHaveProperty("unexpectedField");
    });

    it("rejects a type-malformed payload with BAD_REQUEST", async () => {
      const malformed = { ...sample(`${collection}-bad`), id: 123 };
      await expect(
        domainOf(server.asUid(owner), collection).upsert.mutate(malformed),
      ).rejects.toMatchObject({ data: { code: "BAD_REQUEST" } });
    });

    it("rejects an unauthenticated write with UNAUTHORIZED and writes nothing", async () => {
      const record = sample(`${collection}-noauth`);
      await expect(domainOf(server.call, collection).upsert.mutate(record)).rejects.toMatchObject({
        data: { code: "UNAUTHORIZED" },
      });

      const stored = await createRepository(server.firestore, owner, collection).get(record.id);
      expect(stored).toBeNull();
    });
  });
}
