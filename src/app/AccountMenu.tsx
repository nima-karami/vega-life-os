import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { firebaseEnabled, onAuth, signOutUser } from "@/core/auth";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";

const itemCx =
  "rounded-[var(--radius-sm)] px-2.5 py-2 font-sans text-[13px] text-[var(--color-ink)] data-[hover=true]:bg-[var(--color-canvas)] data-[hover=true]:text-[var(--color-accent)]";

function initials(name: string) {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .map((w) => w[0])
      .join("")
      .slice(0, 2)
      .toUpperCase() || "OP"
  );
}

/**
 * Global account button — the avatar in the top-right of every route (rendered by
 * AppShell). Opens a menu with the operator profile summary plus quick access to
 * Settings and sign-out, so identity/account is reachable everywhere instead of
 * being buried in the Settings page.
 */
export function AccountMenu() {
  const navigate = useNavigate();
  const name = useStore((s) => s.operatorName);
  const profileEmail = useStore((s) => s.operatorEmail);
  const avatar = useStore((s) => s.operatorAvatar);
  const pushToast = useStore((s) => s.pushToast);

  const [authEmail, setAuthEmail] = useState<string | null>(null);
  useEffect(() => onAuth((u) => setAuthEmail(u?.email ?? null)), []);

  const email = authEmail ?? profileEmail;

  const signOut = async () => {
    await signOutUser();
    pushToast("Signed out — local only");
  };

  const authItem = !firebaseEnabled
    ? []
    : authEmail
      ? [
          <DropdownItem
            key="signout"
            startContent={<Icon name="repeat" size={14} />}
            onPress={() => void signOut()}
            className={itemCx}
          >
            Sign out
          </DropdownItem>,
        ]
      : [
          <DropdownItem
            key="signin"
            startContent={<Icon name="user" size={14} />}
            onPress={() => navigate("/settings")}
            className={itemCx}
          >
            Sign in & sync
          </DropdownItem>,
        ];

  return (
    <Dropdown
      placement="bottom-end"
      offset={8}
      classNames={{
        content:
          "min-w-[224px] rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-1.5 shadow-[var(--shadow-soft)]",
      }}
    >
      <DropdownTrigger>
        <button
          type="button"
          aria-label="Account menu"
          className="grid h-9 w-9 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--color-line)] bg-[var(--color-surface)] outline-none transition-colors hover:border-[var(--color-accent)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        >
          {avatar ? (
            <img src={avatar} alt="" className="h-full w-full object-cover" />
          ) : (
            <span className="font-display text-xs font-semibold text-[var(--color-muted)]">
              {initials(name)}
            </span>
          )}
        </button>
      </DropdownTrigger>

      <DropdownMenu aria-label="Account">
        {[
          <DropdownItem
            key="profile"
            isReadOnly
            showDivider
            textValue="Profile"
            className="cursor-default rounded-[var(--radius-sm)] px-2.5 py-2 data-[hover=true]:bg-transparent"
          >
            <div className="flex items-center gap-2.5">
              <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-full border border-[var(--color-line)] bg-[var(--color-canvas)]">
                {avatar ? (
                  <img src={avatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-display text-[11px] font-semibold text-[var(--color-muted)]">
                    {initials(name)}
                  </span>
                )}
              </span>
              <div className="min-w-0">
                <p className="truncate font-sans text-[13px] font-medium text-[var(--color-ink)]">
                  {name || "Operator"}
                </p>
                {email && (
                  <p className="truncate font-sans text-[11px] text-[var(--color-muted)]">
                    {email}
                  </p>
                )}
              </div>
            </div>
          </DropdownItem>,
          <DropdownItem
            key="settings"
            startContent={<Icon name="sliders" size={14} />}
            onPress={() => navigate("/settings")}
            className={itemCx}
          >
            Settings
          </DropdownItem>,
          ...authItem,
        ]}
      </DropdownMenu>
    </Dropdown>
  );
}
