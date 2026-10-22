import { z } from "zod";

type NodeEnv = "development" | "staging" | "test" | "production";

export type OauthConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  tokenEncryptionKey: string;
};

export type ServerConfig = {
  nodeEnv: NodeEnv;
  dbName: string;
  port: number;
  projectId: string;
  oauth: OauthConfig;
};

const DEFAULT_DATABASE = "(default)";

const nodeEnvSchema = z.enum(["development", "staging", "test", "production"]);

function readNodeEnv(raw: string | undefined): NodeEnv {
  const parsed = nodeEnvSchema.safeParse(raw);
  return parsed.success ? parsed.data : "development";
}

export function loadServerConfig(env: NodeJS.ProcessEnv = process.env): ServerConfig {
  return {
    nodeEnv: readNodeEnv(env.NODE_ENV),
    dbName: env.FIRESTORE_DB ?? "",
    port: Number(env.PORT ?? 8080),
    projectId: env.PROJECT_ID ?? env.GOOGLE_CLOUD_PROJECT ?? "vega-life-os",
    oauth: {
      clientId: env.GOOGLE_OAUTH_CLIENT_ID ?? "",
      clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET ?? "",
      redirectUri: env.GOOGLE_OAUTH_REDIRECT_URI ?? "",
      tokenEncryptionKey: env.GCAL_TOKEN_ENC_KEY ?? "",
    },
  };
}

/** Only production may touch the `(default)` database; every other env must name a DB. */
export function assertDbMatchesEnv(config: Pick<ServerConfig, "nodeEnv" | "dbName">): void {
  const isDefaultDatabase = config.dbName === DEFAULT_DATABASE || config.dbName === "";
  if (config.nodeEnv === "production") {
    if (config.dbName !== DEFAULT_DATABASE) {
      throw new Error(
        `production requires the ${DEFAULT_DATABASE} database, got "${config.dbName}"`,
      );
    }
    return;
  }
  if (isDefaultDatabase) {
    throw new Error(`${config.nodeEnv} refuses the prod ${DEFAULT_DATABASE} database`);
  }
}
