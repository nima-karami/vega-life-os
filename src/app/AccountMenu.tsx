import { Avatar, Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { firebaseEnabled, onAuth, signOutUser } from "@/core/auth";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";

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
    pushToast("Signed out");
  };

  const authItem = !firebaseEnabled
    ? []
    : authEmail
      ? [
          <DropdownItem
            key="signout"
            startContent={<Icon name="repeat" size={14} />}
            onPress={() => void signOut()}
          >
            Sign out
          </DropdownItem>,
        ]
      : [
          <DropdownItem
            key="signin"
            startContent={<Icon name="user" size={14} />}
            onPress={() => navigate("/settings")}
          >
            Sign in & sync
          </DropdownItem>,
        ];

  return (
    <Dropdown placement="bottom-end" offset={8}>
      <DropdownTrigger>
        <button
          type="button"
          aria-label="Account menu"
          className="grid h-11 w-11 place-items-center rounded-full outline-none transition-transform focus-visible:ring-2 focus-visible:ring-focus focus-visible:ring-offset-2"
        >
          <Avatar
            size="sm"
            src={avatar || undefined}
            name={initials(name)}
            className="bg-content2 text-tiny text-default-500"
            getInitials={(n) => n}
          />
        </button>
      </DropdownTrigger>

      <DropdownMenu aria-label="Account" className="min-w-[224px]">
        {[
          <DropdownItem
            key="profile"
            isReadOnly
            showDivider
            textValue="Profile"
            className="cursor-default data-[hover=true]:bg-transparent"
          >
            <div className="flex items-center gap-2.5">
              <Avatar
                size="sm"
                src={avatar || undefined}
                name={initials(name)}
                className="bg-content2 text-tiny text-default-500"
                getInitials={(n) => n}
              />
              <div className="min-w-0">
                <p className="truncate text-small font-medium text-foreground">
                  {name || "Operator"}
                </p>
                {email && <p className="truncate text-tiny text-default-500">{email}</p>}
              </div>
            </div>
          </DropdownItem>,
          <DropdownItem
            key="settings"
            startContent={<Icon name="sliders" size={14} />}
            onPress={() => navigate("/settings")}
          >
            Settings
          </DropdownItem>,
          ...authItem,
        ]}
      </DropdownMenu>
    </Dropdown>
  );
}
