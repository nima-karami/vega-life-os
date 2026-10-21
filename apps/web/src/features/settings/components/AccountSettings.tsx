import { Button, Code } from "@heroui/react";
import { useEffect, useState } from "react";
import { AuthForm } from "@/app/AuthForm";
import { firebaseEnabled, onAuth, signOutUser } from "@/core/auth";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";
import { SettingsCard } from "../SettingsCard";

export function AccountSettings() {
  const pushToast = useStore((s) => s.pushToast);
  const [email, setEmail] = useState<string | null>(null);

  useEffect(() => onAuth((u) => setEmail(u?.email ?? null)), []);

  if (!firebaseEnabled) {
    return (
      <SettingsCard title="Account & sync">
        <p className="text-sm leading-relaxed text-muted">
          Cloud sign-in isn't configured yet. Add a Firebase web-app config to{" "}
          <Code>.env.local</Code> (see <Code>.env.example</Code>) and reload to sign in and sync
          across devices. Until then you can explore locally with sample data.
        </p>
      </SettingsCard>
    );
  }

  const signOut = async () => {
    await signOutUser();
    pushToast("Signed out");
  };

  return (
    <SettingsCard title="Account & sync">
      {email ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium text-foreground">{email}</p>
            <p className="mt-1 text-xs text-muted">
              Signed in · synced to your account across devices. This device keeps no local copy.
            </p>
          </div>
          <Button variant="outline" onPress={() => void signOut()}>
            <Icon name="repeat" size={15} />
            Sign out
          </Button>
        </div>
      ) : (
        <div className="flex flex-col gap-5">
          <p className="max-w-md text-sm text-muted">
            Sign in to sync your data to your account across devices. Sample data on this device
            stays local and is never uploaded. Export a backup first if you want to keep it.
          </p>
          <AuthForm />
        </div>
      )}
    </SettingsCard>
  );
}
