import { request } from "node:http";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { mindCards } from "../../../test/data-fixtures";
import { bootTestServer, type TestServer } from "../../../test/harness";

type RawResponse = { bytes: number; encoding: string | undefined; body: Buffer };

function fetchRaw(url: string, uid: string, acceptEncoding: string): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const req = request(
      url,
      { headers: { Authorization: `Bearer ${uid}`, "Accept-Encoding": acceptEncoding } },
      (res) => {
        const chunks: Buffer[] = [];
        res.on("data", (chunk: Buffer) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks);
          resolve({ bytes: body.length, encoding: res.headers["content-encoding"], body });
        });
      },
    );
    req.on("error", reject);
    req.end();
  });
}

describe("wire payload (real server vs emulator)", () => {
  let server: TestServer;
  const uid = `u-wire-${Date.now()}`;

  beforeAll(async () => {
    server = await bootTestServer();
    await server.asUid(uid).data.importCollection.mutate({
      collection: "mindCards",
      records: mindCards(200, "wire"),
    });
  });
  afterAll(async () => {
    await server.close();
  });

  it("ships rows without the server-only field-LWW stamps", async () => {
    const dataset = await server.asUid(uid).data.loadAll.query();
    const listed = await server.asUid(uid).data.list.query({ collection: "mindCards" });

    expect(dataset.mindCards).toHaveLength(200);
    expect(dataset.mindCards.every((row) => !("fieldUpdatedAt" in row))).toBe(true);
    expect(listed.every((row) => !("fieldUpdatedAt" in row))).toBe(true);
    expect(dataset.mindCards[0].updatedAt).toEqual(expect.any(String));
  });

  it("gzips a large response for a client that accepts it", async () => {
    const url = `${server.url}/trpc/data.loadAll`;
    const plain = await fetchRaw(url, uid, "identity");
    const gzipped = await fetchRaw(url, uid, "gzip, deflate, br");

    expect(plain.encoding).toBeUndefined();
    expect(gzipped.encoding).toBe("gzip");
    expect(gzipped.bytes).toBeLessThan(plain.bytes / 4);
  });

  it("leaves a tiny response uncompressed", async () => {
    const counter = await fetchRaw(`${server.url}/trpc/data.syncVersion`, uid, "gzip");

    expect(counter.encoding).toBeUndefined();
    expect(JSON.parse(counter.body.toString()).result.data).toEqual(expect.any(Number));
  });
});
