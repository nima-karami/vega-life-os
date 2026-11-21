import { Button, Chip, Spinner } from "@heroui/react";
import { ACCESS_TOKEN_LIMIT, type AccessTokenRow } from "@vega/shared";
import { format, parseISO } from "date-fns";
import { KeyRound } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { getApiUrl } from "@/core/persistence/trpc-client";
import { useStore } from "@/core/store";
import { ConfirmDialog, Icon } from "@/core/ui";
import { SettingsCard } from "../SettingsCard";
import { useAccessTokens } from "../useAccessTokens";
import { CreateTokenDialog } from "./CreateTokenDialog";

const SCOPE_CHIP: Record<AccessTokenRow["scope"], string> = {
  read: "Read only",
  write: "Read & write",
};

async function copyText(text: string, pushToast: (message: string) => void) {
  try {
    await navigator.clipboard.writeText(text);
    pushToast("Copied");
  } catch {
    pushToast("Couldn't copy, select the text instead");
  }
}

function formatTokenStamp(iso: string | null): string {
  if (iso === null) return "never";
  return format(parseISO(iso), "MMM d, yyyy");
}

function EndpointRow({ endpointUrl, onCopy }: { endpointUrl: string; onCopy: () => void }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-muted">MCP endpoint</span>
        <Button size="sm" variant="outline" onPress={onCopy}>
          <Icon name="copy" size={14} />
          Copy
        </Button>
      </div>
      <p className="break-all font-mono text-xs text-foreground">{endpointUrl}</p>
    </div>
  );
}

function TokenRow({
  token,
  isRevoking,
  isRevokeBlocked,
  onRevoke,
}: {
  token: AccessTokenRow;
  isRevoking: boolean;
  isRevokeBlocked: boolean;
  onRevoke: () => void;
}) {
  return (
    <div className="flex flex-col gap-2 rounded-xl border border-border px-3 py-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0 space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">{token.name}</span>
          <Chip size="sm" variant="soft">
            <Chip.Label>{SCOPE_CHIP[token.scope]}</Chip.Label>
          </Chip>
        </div>
        <p className="text-xs text-muted">
          Created {formatTokenStamp(token.createdAt)} · Last used{" "}
          {formatTokenStamp(token.lastUsedAt)}
        </p>
      </div>
      <Button
        size="sm"
        variant="danger-soft"
        isDisabled={isRevoking || isRevokeBlocked}
        onPress={onRevoke}
        aria-busy={isRevoking || undefined}
      >
        {isRevoking ? (
          <span className="inline-flex items-center gap-2">
            <Spinner size="sm" color="current" />
            Revoking…
          </span>
        ) : (
          <>
            <Icon name="trash" size={14} />
            Revoke
          </>
        )}
      </Button>
    </div>
  );
}

function AgentAccessSettingsSignedIn() {
  const pushToast = useStore((s) => s.pushToast);
  const { tokens, status, reload, create, revoke } = useAccessTokens();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [revokeTarget, setRevokeTarget] = useState<AccessTokenRow | null>(null);
  const [revokingId, setRevokingId] = useState<string | null>(null);
  const revokeInFlightRef = useRef(false);
  const isMountedRef = useRef(true);
  useEffect(
    () => () => {
      isMountedRef.current = false;
    },
    [],
  );

  const endpointUrl = `${getApiUrl()}/mcp`;
  const isAtTokenLimit = tokens.length >= ACCESS_TOKEN_LIMIT;

  const handleRevokeConfirm = async () => {
    if (revokeTarget === null || revokeInFlightRef.current) return;
    revokeInFlightRef.current = true;
    const { id, name } = revokeTarget;
    setRevokeTarget(null);
    setRevokingId(id);
    try {
      await revoke(id);
      if (isMountedRef.current) pushToast(`Revoked ${name}`);
    } catch {
      if (isMountedRef.current) pushToast("Couldn't revoke");
    } finally {
      revokeInFlightRef.current = false;
      if (isMountedRef.current) setRevokingId(null);
    }
  };

  const newTokenAction = (
    <Button
      size="sm"
      variant="primary"
      isDisabled={isAtTokenLimit || status === "loading"}
      onPress={() => setDialogOpen(true)}
    >
      <KeyRound size={15} aria-hidden />
      New token
    </Button>
  );

  return (
    <SettingsCard
      title="Agent access (MCP)"
      description="Personal access tokens let Claude Code, Codex, Cursor and other agents read and update your VEGA data over HTTP."
      action={status === "ready" ? newTokenAction : undefined}
    >
      <div className="flex flex-col gap-4">
        {status === "loading" && (
          <p className="flex items-center gap-2 text-sm text-muted">
            <Spinner size="sm" />
            Loading tokens…
          </p>
        )}
        {status === "error" && (
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-muted">Couldn&apos;t load tokens</p>
            <Button size="sm" variant="outline" onPress={() => void reload({ showLoading: true })}>
              Retry
            </Button>
          </div>
        )}
        {status === "ready" && (
          <>
            <EndpointRow
              endpointUrl={endpointUrl}
              onCopy={() => void copyText(endpointUrl, pushToast)}
            />
            {tokens.length === 0 ? (
              <p className="text-sm text-muted">No tokens yet</p>
            ) : (
              <div className="space-y-2">
                {tokens.map((token) => (
                  <TokenRow
                    key={token.id}
                    token={token}
                    isRevoking={revokingId === token.id}
                    isRevokeBlocked={revokingId !== null && revokingId !== token.id}
                    onRevoke={() => {
                      if (revokingId !== null) return;
                      setRevokeTarget(token);
                    }}
                  />
                ))}
              </div>
            )}
            {isAtTokenLimit && (
              <p className="text-sm text-muted">Revoke a token to create another</p>
            )}
          </>
        )}
      </div>
      <CreateTokenDialog
        open={dialogOpen}
        endpointUrl={endpointUrl}
        onCreate={create}
        onClose={() => setDialogOpen(false)}
      />
      <ConfirmDialog
        open={revokeTarget !== null}
        title={revokeTarget ? `Revoke ${revokeTarget.name}?` : ""}
        body="Agents using it stop working."
        confirmLabel="Revoke"
        danger
        onConfirm={() => void handleRevokeConfirm()}
        onClose={() => {
          if (revokingId === null) setRevokeTarget(null);
        }}
      />
    </SettingsCard>
  );
}

export function AgentAccessSettings() {
  const authUid = useStore((s) => s.authUid);

  if (authUid == null) {
    return (
      <SettingsCard title="Agent access (MCP)">
        <p className="text-sm text-muted">Sign in to connect agents to your VEGA account.</p>
      </SettingsCard>
    );
  }

  return <AgentAccessSettingsSignedIn key={authUid} />;
}
