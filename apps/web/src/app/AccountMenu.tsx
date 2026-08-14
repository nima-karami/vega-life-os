import { Avatar, Dropdown } from "@heroui/react";
import { type ReactNode, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { firebaseEnabled, onAuth, signOutUser } from "@/core/auth";
import { useStore } from "@/core/store";
import { cx, Icon } from "@/core/ui";

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

function AccountAvatar({
  src,
  label,
  size = "sm",
}: {
  src?: string;
  label: string;
  size?: "sm" | "md";
}) {
  return (
    <Avatar size={size} className="bg-surface-secondary text-xs text-muted">
      {src ? <Avatar.Image src={src} alt="" /> : null}
      <Avatar.Fallback>{label}</Avatar.Fallback>
    </Avatar>
  );
}

/** Global account avatar: profile summary, Settings, sign-out. Defaults to the
 *  desktop header placement; the phone bottom-nav passes a compact trigger and an
 *  upward (`top end`) menu. */
export function AccountMenu({
  placement = "bottom end",
  avatarSize = "md",
  triggerClassName = "grid h-11 w-11 place-items-center rounded-full outline-none transition-transform focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
}: {
  placement?: "bottom end" | "top end";
  avatarSize?: "sm" | "md";
  triggerClassName?: string;
} = {}) {
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

  const authItem: ReactNode = !firebaseEnabled ? null : authEmail ? (
    <Dropdown.Item
      id="signout"
      textValue="Sign out"
      onAction={() => void signOut()}
      className="rounded-[var(--radius-floating-row)]"
    >
      <Icon name="repeat" size={14} />
      Sign out
    </Dropdown.Item>
  ) : (
    <Dropdown.Item
      id="signin"
      textValue="Sign in & sync"
      onAction={() => navigate("/settings")}
      className="rounded-[var(--radius-floating-row)]"
    >
      <Icon name="user" size={14} />
      Sign in & sync
    </Dropdown.Item>
  );

  return (
    <Dropdown>
      <Dropdown.Trigger aria-label="Account menu" className={triggerClassName}>
        <AccountAvatar src={avatar || undefined} label={initials(name)} size={avatarSize} />
      </Dropdown.Trigger>

      <Dropdown.Popover
        placement={placement}
        offset={8}
        className="rounded-[var(--radius-floating)]"
      >
        <Dropdown.Menu aria-label="Account" className="min-w-[224px]">
          <Dropdown.Item
            id="profile"
            isDisabled
            textValue="Profile"
            className={cx("rounded-[var(--radius-floating-row)]", "cursor-default opacity-100")}
          >
            <div className="flex items-center gap-2.5">
              <AccountAvatar src={avatar || undefined} label={initials(name)} />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-foreground">{name || "Operator"}</p>
                {email && <p className="truncate text-xs text-muted">{email}</p>}
              </div>
            </div>
          </Dropdown.Item>
          <Dropdown.Item
            id="settings"
            textValue="Settings"
            onAction={() => navigate("/settings")}
            className="rounded-[var(--radius-floating-row)]"
          >
            <Icon name="sliders" size={14} />
            Settings
          </Dropdown.Item>
          {authItem}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
