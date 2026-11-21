import { Button, ButtonGroup, Modal, Spinner, useOverlayState } from "@heroui/react";
import { TRPCClientError } from "@trpc/client";
import type { AccessTokenCreated, AccessTokenCreateInput, AccessTokenScope } from "@vega/shared";
import { useEffect, useState } from "react";
import { useStore } from "@/core/store";
import { FIELD_CLASS, Icon } from "@/core/ui";
import { smallCenteredDialogContainer } from "@/core/ui/modal";
import { buildConnectSnippets } from "./connect-snippets";

type Phase = "form" | "creating" | "created";

const SCOPE_LABEL: Record<AccessTokenScope, string> = {
  read: "Read only",
  write: "Read & write",
};

function readCreateError(error: unknown): string {
  if (error instanceof TRPCClientError) {
    const message = error.message;
    if (message.includes("token limit")) return "Token limit reached. Revoke one first.";
    if (message.includes("invalid time zone")) return "Invalid time zone.";
    return message;
  }
  return "Couldn't create token. Try again.";
}

async function copyText(text: string, pushToast: (message: string) => void) {
  try {
    await navigator.clipboard.writeText(text);
    pushToast("Copied");
  } catch {
    pushToast("Couldn't copy, select the text instead");
  }
}

function SnippetBlock({
  label,
  value,
  onCopy,
  disabled,
}: {
  label: string;
  value: string;
  onCopy: () => void;
  disabled: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium text-foreground">{label}</span>
        <Button size="sm" variant="outline" isDisabled={disabled} onPress={onCopy}>
          <Icon name="copy" size={14} />
          Copy
        </Button>
      </div>
      <textarea
        readOnly
        aria-label={label}
        value={value}
        rows={label === "JSON" ? 6 : 3}
        className={`${FIELD_CLASS} resize-none font-mono text-xs`}
      />
    </div>
  );
}

export function CreateTokenDialog({
  open,
  endpointUrl,
  onCreate,
  onClose,
}: {
  open: boolean;
  endpointUrl: string;
  onCreate: (input: AccessTokenCreateInput) => Promise<AccessTokenCreated>;
  onClose: () => void;
}) {
  const pushToast = useStore((s) => s.pushToast);
  const [phase, setPhase] = useState<Phase>("form");
  const [name, setName] = useState("");
  const [scope, setScope] = useState<AccessTokenScope>("read");
  const [created, setCreated] = useState<AccessTokenCreated | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const lockDismiss = phase === "creating" || phase === "created";

  const state = useOverlayState({
    isOpen: open,
    onOpenChange: (next) => {
      if (!next && lockDismiss) return;
      if (!next) onClose();
    },
  });

  useEffect(() => {
    if (!open) return;
    setPhase("form");
    setName("");
    setScope("read");
    setCreated(null);
    setErrorMessage(null);
  }, [open]);

  const inputsDisabled = phase === "creating" || phase === "created";
  const trimmedName = name.trim();
  const canCreate = trimmedName.length > 0 && phase !== "creating" && phase !== "created";

  const submit = async () => {
    if (!canCreate) return;
    setPhase("creating");
    setErrorMessage(null);
    try {
      const result = await onCreate({
        name: trimmedName,
        scope,
        timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      });
      setCreated(result);
      setPhase("created");
    } catch (error) {
      setErrorMessage(readCreateError(error));
      setPhase("form");
    }
  };

  const snippets = created !== null ? buildConnectSnippets(endpointUrl, created.token) : null;

  return (
    <Modal state={state}>
      <Modal.Backdrop variant="blur" isDismissable={!lockDismiss}>
        <Modal.Container {...smallCenteredDialogContainer}>
          <Modal.Dialog aria-label={phase === "created" ? "Token created" : "New access token"}>
            <Modal.Header>
              <Modal.Heading className="text-lg font-semibold tracking-tight">
                {phase === "created" ? "Token created" : "New token"}
              </Modal.Heading>
            </Modal.Header>
            <Modal.Body className="space-y-4">
              {phase === "created" && created !== null && snippets !== null ? (
                <>
                  <p className="text-sm text-warning">You won&apos;t see this token again.</p>
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium text-foreground">Token</span>
                      <Button
                        size="sm"
                        variant="outline"
                        onPress={() => void copyText(created.token, pushToast)}
                      >
                        <Icon name="copy" size={14} />
                        Copy
                      </Button>
                    </div>
                    <input
                      readOnly
                      aria-label="Access token"
                      value={created.token}
                      className={`${FIELD_CLASS} font-mono text-xs`}
                    />
                  </div>
                  <SnippetBlock
                    label="Claude Code"
                    value={snippets.claudeCode}
                    disabled={false}
                    onCopy={() => void copyText(snippets.claudeCode, pushToast)}
                  />
                  <SnippetBlock
                    label="Codex"
                    value={snippets.codex}
                    disabled={false}
                    onCopy={() => void copyText(snippets.codex, pushToast)}
                  />
                  <SnippetBlock
                    label="JSON"
                    value={snippets.json}
                    disabled={false}
                    onCopy={() => void copyText(snippets.json, pushToast)}
                  />
                </>
              ) : (
                <>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-sm font-medium text-foreground">Name</span>
                    <input
                      type="text"
                      autoFocus
                      value={name}
                      disabled={inputsDisabled}
                      placeholder="MacBook Claude"
                      autoComplete="off"
                      maxLength={60}
                      onChange={(event) => setName(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          void submit();
                        }
                      }}
                      className={FIELD_CLASS}
                    />
                  </label>
                  <div>
                    <span className="mb-2 block text-sm font-medium text-foreground">Scope</span>
                    <ButtonGroup aria-label="Token scope">
                      {(["read", "write"] as const).map((value) => (
                        <Button
                          key={value}
                          size="sm"
                          aria-pressed={scope === value}
                          variant={scope === value ? "primary" : "outline"}
                          isDisabled={inputsDisabled}
                          onPress={() => setScope(value)}
                        >
                          {SCOPE_LABEL[value]}
                        </Button>
                      ))}
                    </ButtonGroup>
                  </div>
                  {errorMessage !== null && <p className="text-sm text-danger">{errorMessage}</p>}
                </>
              )}
            </Modal.Body>
            <Modal.Footer>
              {phase === "created" ? (
                <Button variant="primary" onPress={onClose}>
                  Done
                </Button>
              ) : (
                <>
                  <Button variant="ghost" isDisabled={phase === "creating"} onPress={onClose}>
                    Cancel
                  </Button>
                  <Button
                    variant="primary"
                    isDisabled={!canCreate}
                    aria-busy={phase === "creating" || undefined}
                    onPress={() => void submit()}
                  >
                    {phase === "creating" ? (
                      <span className="inline-flex items-center gap-2">
                        <Spinner size="sm" color="current" />
                        Create
                      </span>
                    ) : (
                      "Create"
                    )}
                  </Button>
                </>
              )}
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
