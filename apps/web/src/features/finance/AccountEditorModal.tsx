import { Button } from "@heroui/react";
import type { FinanceAccount, FinanceAccountKind } from "@vega/shared";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/core/store";
import { CheckField, FIELD_CLASS, SegmentButton } from "@/core/ui";
import { describeAccountKind } from "./account-copy";
import { deriveAccountSlug } from "./account-slug";
import { FinanceModalFrame } from "./FinanceModalFrame";

const KINDS: FinanceAccountKind[] = ["chequing", "savings", "credit_card"];

const BUSINESS_HELPER =
  "Kept out of personal budgets unless the dashboard is switched to With business.";
const SLUG_CAPTION = "Used in duplicate keys — fixed";
const NAME_MAX_LENGTH = 60;
const FOOTER_BUTTON_CLASS = "h-11 sm:h-9";

export interface AccountEditorModalProps {
  /** null creates; a row renames. Create and rename share one editor. */
  account: FinanceAccount | null;
  onClose: () => void;
  /** the freshly created row, so the import picker can select it */
  onCreated?: (account: FinanceAccount) => void;
}

/** What an account *is* — the slug is derived once at creation and shown, never edited. */
export function AccountEditorModal({ account, onClose, onCreated }: AccountEditorModalProps) {
  const financeAccounts = useStore((s) => s.financeAccounts);
  const addFinanceAccount = useStore((s) => s.addFinanceAccount);
  const updateFinanceAccount = useStore((s) => s.updateFinanceAccount);

  const [name, setName] = useState(account?.displayName ?? "");
  const [kind, setKind] = useState<FinanceAccountKind>(account?.kind ?? "chequing");
  const [isBusiness, setIsBusiness] = useState(account?.isBusiness ?? false);

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const trimmedName = name.trim();
  const canSave = trimmedName !== "";

  const handleSave = () => {
    if (!canSave) return;
    if (account) {
      updateFinanceAccount(account.id, { displayName: trimmedName, kind, isBusiness });
    } else {
      const created = addFinanceAccount({
        displayName: trimmedName,
        kind,
        isBusiness,
        slug: deriveAccountSlug(trimmedName, financeAccounts),
      });
      onCreated?.(created);
    }
    onClose();
  };

  return (
    <FinanceModalFrame
      title={account ? "Account" : "New account"}
      onClose={onClose}
      footer={
        <>
          <Button size="sm" variant="ghost" className={FOOTER_BUTTON_CLASS} onPress={onClose}>
            Cancel
          </Button>
          <Button
            size="sm"
            variant="primary"
            className={FOOTER_BUTTON_CLASS}
            isDisabled={!canSave}
            onPress={handleSave}
          >
            {account ? "Save" : "Create account"}
          </Button>
        </>
      }
    >
      <label className="block space-y-2">
        <span className="text-xs text-muted">Name</span>
        <input
          ref={nameRef}
          type="text"
          aria-label="Account name"
          value={name}
          maxLength={NAME_MAX_LENGTH}
          placeholder="Everyday chequing"
          onChange={(event) => setName(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") handleSave();
          }}
          className={FIELD_CLASS}
        />
      </label>

      <div className="space-y-2">
        <span className="text-xs text-muted">Kind</span>
        <fieldset className="flex gap-2" aria-label="Account kind">
          {KINDS.map((option) => (
            <SegmentButton
              key={option}
              isSelected={kind === option}
              onClick={() => setKind(option)}
            >
              {describeAccountKind(option)}
            </SegmentButton>
          ))}
        </fieldset>
      </div>

      <div className="space-y-2">
        <CheckField
          isSelected={isBusiness}
          onChange={() => setIsBusiness(!isBusiness)}
          label="Business account"
          className="h-11 sm:h-auto"
        >
          <span className="text-[13px] text-foreground">Business account</span>
        </CheckField>
        <p className="text-xs text-muted">{BUSINESS_HELPER}</p>
      </div>

      {account && (
        <div className="space-y-1">
          <div className="flex items-baseline justify-between gap-3">
            <span className="text-xs text-muted">Slug</span>
            <span className="truncate font-mono text-[12.5px] text-foreground">{account.slug}</span>
          </div>
          <p className="text-xs text-muted">{SLUG_CAPTION}</p>
        </div>
      )}
    </FinanceModalFrame>
  );
}
