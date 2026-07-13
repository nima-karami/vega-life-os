import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bootTestServer, type TestServer } from "../../../test/harness";
import { registerChannel } from "../channel-registry";

type WebhookResult = { outcome: string; uid?: string };

describe("gcal webhook channel-auth (real HTTP route)", () => {
  let server: TestServer;

  beforeAll(async () => {
    server = await bootTestServer();
    await registerChannel(server.firestore, {
      channelId: "chan-known",
      channelToken: "tok-secret",
      resourceId: "res-1",
      uid: "u-webhook",
      calendarId: "cal-1",
      expiration: new Date(Date.now() + 7 * 864e5).toISOString(),
    });
  });
  afterAll(async () => {
    await server.close();
  });

  const post = async (headers: Record<string, string>): Promise<WebhookResult> => {
    const res = await fetch(`${server.url}/webhooks/gcal`, { method: "POST", headers });
    return (await res.json()) as WebhookResult;
  };

  it("honors a notification whose channel id + token match the registry", async () => {
    const body = await post({
      "X-Goog-Channel-Id": "chan-known",
      "X-Goog-Channel-Token": "tok-secret",
      "X-Goog-Resource-State": "exists",
    });
    expect(body).toEqual({ outcome: "applied", uid: "u-webhook" });
  });

  it("ignores the initial sync handshake", async () => {
    const body = await post({
      "X-Goog-Channel-Id": "chan-known",
      "X-Goog-Channel-Token": "tok-secret",
      "X-Goog-Resource-State": "sync",
    });
    expect(body.outcome).toBe("ignored");
  });

  it("drops an unknown channel id", async () => {
    const body = await post({
      "X-Goog-Channel-Id": "chan-unknown",
      "X-Goog-Channel-Token": "tok-secret",
      "X-Goog-Resource-State": "exists",
    });
    expect(body.outcome).toBe("dropped");
  });

  it("drops a known channel presenting the wrong token", async () => {
    const body = await post({
      "X-Goog-Channel-Id": "chan-known",
      "X-Goog-Channel-Token": "tok-wrong",
      "X-Goog-Resource-State": "exists",
    });
    expect(body.outcome).toBe("dropped");
  });
});
