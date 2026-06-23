import { Button, Input } from "@heroui/react";
import { useState } from "react";
import { authErrorMessage, signInWithEmail, signInWithGoogle, signUpWithEmail } from "@/core/auth";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";

export function AuthForm({ autoFocus = false }: { autoFocus?: boolean }) {
  const pushToast = useStore((s) => s.pushToast);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });

  const google = async () => {
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

  const emailAuth = async (mode: "in" | "up") => {
    const email = form.email.trim();
    if (!email || !form.password) {
      pushToast("Enter an email and password.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "up") {
        await signUpWithEmail(email, form.password);
        pushToast("Account created — syncing");
      } else {
        await signInWithEmail(email, form.password);
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
    <div className="flex flex-col gap-5">
      <Button
        color="primary"
        startContent={<Icon name="spark" size={15} />}
        isDisabled={busy}
        onPress={() => void google()}
        className="w-full"
      >
        Continue with Google
      </Button>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-divider" />
        <span className="text-tiny text-default-500">or email</span>
        <div className="h-px flex-1 bg-divider" />
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
          autoFocus={autoFocus}
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
            color="primary"
            startContent={<Icon name="mail" size={15} />}
            isDisabled={busy}
          >
            Sign in
          </Button>
          <Button
            type="button"
            variant="bordered"
            startContent={<Icon name="plus" size={15} />}
            isDisabled={busy}
            onPress={() => void emailAuth("up")}
          >
            Create account
          </Button>
        </div>
      </form>
    </div>
  );
}
