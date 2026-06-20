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
import { Button, Icon, Label, Panel, SectionHead } from "@/core/ui";

export function AccountSettings() {
  const pushToast = useStore((s) => s.pushToast);
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  useEffect(() => onAuth((u) => setEmail(u?.email ?? null)), []);

  if (!firebaseEnabled) {
    return (
      <Panel className="mb-4 p-5">
        <SectionHead title="account · sync" />
        <p className="mono mt-3 text-[11px] leading-relaxed text-stone">
          Cloud sync is off. Add a Firebase web-app config to <code>.env.local</code> (see
          <code> .env.example</code>) and reload to enable signing in and cross-device sync. VEGA
          works fully offline without it.
        </p>
      </Panel>
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
    <Panel className="mb-4 p-5">
      <SectionHead title="account · sync" />
      {email ? (
        <div className="mt-4 flex items-center justify-between gap-3">
          <div>
            <Label>signed in</Label>
            <p className="mono text-[13px] text-ink">{email}</p>
            <p className="mono mt-1 text-[10px] text-mist">
              Data syncs across your devices in real time.
            </p>
          </div>
          <Button icon="repeat" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      ) : (
        <div className="mt-4 flex flex-col gap-4">
          <div className="flex items-center justify-between gap-3">
            <p className="mono text-[11px] text-stone">
              Sign in to sync across devices. Local data merges up on first sign-in.
            </p>
            <Button solid icon="spark" disabled={busy} onClick={() => void signIn()}>
              <Icon name="spark" size={14} /> Continue with Google
            </Button>
          </div>

          <div className="flex items-center gap-3">
            <div className="h-px flex-1 bg-[var(--color-line)]" />
            <span className="mono text-[9px] uppercase tracking-[0.18em] text-mist">or email</span>
            <div className="h-px flex-1 bg-[var(--color-line)]" />
          </div>

          <form
            className="flex flex-col gap-3"
            onSubmit={(ev) => {
              ev.preventDefault();
              void emailAuth("in");
            }}
          >
            <label className="flex flex-col gap-1.5 border border-[var(--color-line)] px-3 py-2.5">
              <Label>email</Label>
              <input
                type="email"
                autoComplete="email"
                value={form.email}
                onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                placeholder="you@example.com"
                className="mono w-full bg-transparent text-[13px] outline-none placeholder:text-mist"
              />
            </label>
            <label className="flex flex-col gap-1.5 border border-[var(--color-line)] px-3 py-2.5">
              <Label>password</Label>
              <input
                type="password"
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                placeholder="at least 6 characters"
                className="mono w-full bg-transparent text-[13px] outline-none placeholder:text-mist"
              />
            </label>
            <div className="flex items-center gap-2">
              <Button solid type="submit" icon="mail" disabled={busy}>
                Sign in
              </Button>
              <Button
                type="button"
                icon="plus"
                disabled={busy}
                onClick={() => void emailAuth("up")}
              >
                Create account
              </Button>
            </div>
          </form>
        </div>
      )}
    </Panel>
  );
}
