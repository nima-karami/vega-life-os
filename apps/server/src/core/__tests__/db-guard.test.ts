import { describe, expect, it } from "vitest";
import { assertDbMatchesEnv, loadServerConfig } from "../config";

describe("assertDbMatchesEnv", () => {
  it("refuses the prod (default) database under NODE_ENV=test", () => {
    expect(() => assertDbMatchesEnv({ nodeEnv: "test", dbName: "(default)" })).toThrow(
      /refuses.*prod/i,
    );
  });

  it("refuses an unset database under NODE_ENV=test", () => {
    expect(() => assertDbMatchesEnv({ nodeEnv: "test", dbName: "" })).toThrow(/refuses.*prod/i);
  });

  it("refuses the prod (default) database under NODE_ENV=staging", () => {
    expect(() => assertDbMatchesEnv({ nodeEnv: "staging", dbName: "(default)" })).toThrow(
      /refuses.*prod/i,
    );
  });

  it("allows a named database under NODE_ENV=test", () => {
    expect(() => assertDbMatchesEnv({ nodeEnv: "test", dbName: "test" })).not.toThrow();
  });

  it("allows the (default) database under NODE_ENV=production", () => {
    expect(() => assertDbMatchesEnv({ nodeEnv: "production", dbName: "(default)" })).not.toThrow();
  });

  it("refuses a named database under NODE_ENV=production", () => {
    expect(() => assertDbMatchesEnv({ nodeEnv: "production", dbName: "staging-db" })).toThrow(
      /production/i,
    );
  });
});

describe("loadServerConfig", () => {
  it("reads FIRESTORE_DB, NODE_ENV, and PORT from the environment", () => {
    const config = loadServerConfig({
      NODE_ENV: "test",
      FIRESTORE_DB: "test",
      PORT: "1234",
    } as NodeJS.ProcessEnv);
    expect(config).toMatchObject({ nodeEnv: "test", dbName: "test", port: 1234 });
  });

  it("falls back to development for an unknown NODE_ENV", () => {
    const config = loadServerConfig({ NODE_ENV: "nonsense" } as NodeJS.ProcessEnv);
    expect(config.nodeEnv).toBe("development");
  });
});
