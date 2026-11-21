import type { AccessTokenCreated, AccessTokenCreateInput, AccessTokenRow } from "@vega/shared";
import { useCallback, useEffect, useRef, useState } from "react";
import { getTrpcClient } from "@/core/persistence/trpc-client";

export function useAccessTokens() {
  const [tokens, setTokens] = useState<AccessTokenRow[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const loadGenerationRef = useRef(0);

  const reload = useCallback(async (options?: { showLoading?: boolean }) => {
    const generation = ++loadGenerationRef.current;
    setStatus((current) => (options?.showLoading || current === "loading" ? "loading" : current));
    try {
      const rows = await getTrpcClient().accessTokens.list.query();
      if (generation !== loadGenerationRef.current) return;
      setTokens(rows);
      setStatus("ready");
    } catch {
      if (generation !== loadGenerationRef.current) return;
      setStatus("error");
    }
  }, []);

  useEffect(() => {
    void reload();
  }, [reload]);

  const create = async (input: AccessTokenCreateInput): Promise<AccessTokenCreated> => {
    const result = await getTrpcClient().accessTokens.create.mutate(input);
    setTokens((current) => [result.row, ...current]);
    void reload();
    return result;
  };

  const revoke = async (id: string): Promise<void> => {
    await getTrpcClient().accessTokens.revoke.mutate({ id });
    setTokens((current) => current.filter((row) => row.id !== id));
    void reload();
  };

  return { tokens, status, reload, create, revoke };
}
