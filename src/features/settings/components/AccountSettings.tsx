import { useEffect, useState } from "react";
import { firebaseEnabled, onAuth, signInWithGoogle, signOutUser } from "@/core/auth";
import { useStore } from "@/core/store";
import { Button, Icon, Label, Panel, SectionHead } from "@/core/ui";

export function AccountSettings() {
  const pushToast = useStore((s) => s.pushToast);
  const [email, setEmail] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

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
        <div className="mt-4 flex items-center justify-between gap-3">
          <p className="mono text-[11px] text-stone">
            Sign in to sync across devices. Local data merges up on first sign-in.
          </p>
          <Button solid icon="spark" disabled={busy} onClick={() => void signIn()}>
            <Icon name="spark" size={14} /> Continue with Google
          </Button>
        </div>
      )}
    </Panel>
  );
}
