import { Button, Input } from "@heroui/react";
import { useEffect, useState } from "react";
import {
  authErrorMessage,
  firebaseEnabled,
  onAuth,
  signInWithEmail,
  signInWithGoogle,
  signOutUser,
  signUpWithEmail,
} from "@/core/auth";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";
import { SettingsCard } from "../SettingsCard";

export function AccountSettings() {
  const pushToast = useStore((s) => s.pushToast);
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  useEffect(() => onAuth((u) => setEmail(u?.email ?? null)), []);

  if (!firebaseEnabled) {
    return (
      <SettingsCard title="Account & sync">
        <p className="font-sans text-sm leading-relaxed text-[var(--color-muted)]">
          Cloud sync is off. Add a Firebase web-app config to{" "}
          <code className="font-mono text-xs">.env.local</code> (see{" "}
          <code className="font-mono text-xs">.env.example</code>) and reload to enable signing in
          and cross-device sync. VEGA works fully offline without it.
        </p>
      </SettingsCard>
    );
  }

  const signIn = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
      pushToast("Signed in — syncing");
    } catch {
      pushToast("Sign-in cancelled");
    } finally {
      setBusy(false);
    }
  };
  const signOut = async () => {
    await signOutUser();
    pushToast("Signed out — local only");
  };
  const emailAuth = async (mode: "in" | "up") => {
    const e = form.email.trim();
    if (!e || !form.password) {
      pushToast("Enter an email and password.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "up") {
        await signUpWithEmail(e, form.password);
        pushToast("Account created — syncing");
      } else {
        await signInWithEmail(e, form.password);
        pushToast("Signed in — syncing");
      }
      setForm({ email: "", password: "" });
    } catch (err) {
      pushToast(authErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SettingsCard title="Account & sync">
      {email ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-sans text-sm font-medium text-[var(--color-ink)]">{email}</p>
            <p className="mt-1 font-sans text-xs text-[var(--color-muted)]">
              Signed in · data syncs across your devices in real time.
            </p>
          </div>
          <Button
            variant="bordered"
            className="border-[var(--color-line)] font-sans text-[var(--color-ink)]"
            startContent={<Icon name="repeat" size={15} />}
            onPress={() => void signOut()}
          >
            Sign out
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="max-w-sm font-sans text-sm text-[var(--color-muted)]">
              Sign in to sync across devices. Local data merges up on first sign-in.
            </p>
            <Button
              className="bg-[var(--color-accent)] font-sans text-[var(--color-accent-foreground)]"
              startContent={<Icon name="spark" size={15} />}
              isDisabled={busy}
              onPress={() => void signIn()}
            >
              Continue with Google
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--color-line)]" />
            <span className="font-sans text-xs text-[var(--color-muted)]">or email</span>
            <div className="h-px flex-1 bg-[var(--color-line)]" />
          </div>

          <form
            className="flex flex-col gap-3"
            onSubmit={(ev) => {
              ev.preventDefault();
              void emailAuth("in");
            }}
          >
            <Input
              type="email"
              label="Email"
              labelPlacement="outside"
              autoComplete="email"
              value={form.email}
              onValueChange={(v) => setForm((f) => ({ ...f, email: v }))}
              placeholder="you@example.com"
              variant="bordered"
              radius="md"
            />
            <Input
              type="password"
              label="Password"
              labelPlacement="outside"
              autoComplete="current-password"
              value={form.password}
              onValueChange={(v) => setForm((f) => ({ ...f, password: v }))}
              placeholder="at least 6 characters"
              variant="bordered"
              radius="md"
            />
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="submit"
                className="bg-[var(--color-accent)] font-sans text-[var(--color-accent-foreground)]"
                startContent={<Icon name="mail" size={15} />}
                isDisabled={busy}
              >
                Sign in
              </Button>
              <Button
                type="button"
                variant="bordered"
                className="border-[var(--color-line)] font-sans text-[var(--color-ink)]"
                startContent={<Icon name="plus" size={15} />}
                isDisabled={busy}
                onPress={() => void emailAuth("up")}
              >
                Create account
              </Button>
            </div>
          </form>
        </div>
      )}
    </SettingsCard>
  );
}
