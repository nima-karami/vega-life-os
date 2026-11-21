import type { AccessTokenCreated, AccessTokenCreateInput, AccessTokenRow } from "@vega/shared";
import { useCallback, useEffect, useState } from "react";
import { getTrpcClient } from "@/core/persistence/trpc-client";

export function useAccessTokens() {
  const [tokens, setTokens] = useState<AccessTokenRow[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const reload = useCallback(async (options?: { showLoading?: boolean }) => {
    setStatus((current) => (options?.showLoading || current === "loading" ? "loading" : current));
    try {
      const rows = await getTrpcClient().accessTokens.list.query();
      setTokens(rows);
      setStatus("ready");
    } catch {
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = async (input: AccessTokenCreateInput): Promise<AccessTokenCreated> => {
    const result = await getTrpcClient().accessTokens.create.mutate(input);
    await reload();
    return result;
  };

  const revoke = async (id: string): Promise<void> => {
    await getTrpcClient().accessTokens.revoke.mutate({ id });
    await reload();
  };

  return { tokens, status, reload, create, revoke };
}
