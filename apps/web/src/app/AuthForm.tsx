import { Button } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { formatAuthError, signInWithEmail, signInWithGoogle, signUpWithEmail } from "@/core/auth";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";

const FIELD =
  "w-full rounded-[12px] border border-border bg-surface px-3 py-2 text-[16px] text-foreground outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent sm:text-sm";

export function AuthForm({ autoFocus = false }: { autoFocus?: boolean }) {
  const pushToast = useStore((s) => s.pushToast);
  const [busy, setBusy] = useState(false);
  const [form, setForm] = useState({ email: "", password: "" });
  const emailRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (autoFocus) emailRef.current?.focus();
  }, [autoFocus]);

  const google = async () => {
    setBusy(true);
    try {
      await signInWithGoogle();
      pushToast("Signed in, syncing");
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
        pushToast("Account created, syncing");
      } else {
        await signInWithEmail(email, form.password);
        pushToast("Signed in, syncing");
      }
      setForm({ email: "", password: "" });
    } catch (err) {
      pushToast(formatAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col gap-5">
      <Button variant="primary" isDisabled={busy} onPress={() => void google()} className="w-full">
        <Icon name="spark" size={15} />
        Continue with Google
      </Button>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-xs text-muted">or email</span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <form
        className="flex flex-col gap-3"
        onSubmit={(ev) => {
          ev.preventDefault();
          void emailAuth("in");
        }}
      >
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Email</span>
          <input
            ref={emailRef}
            type="email"
            autoComplete="email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
            placeholder="you@example.com"
            className={FIELD}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-sm font-medium text-foreground">Password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={form.password}
            onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
            placeholder="at least 6 characters"
            className={FIELD}
          />
        </label>
        <div className="flex flex-wrap items-center gap-2">
          <Button type="submit" variant="primary" isDisabled={busy}>
            <Icon name="mail" size={15} />
            Sign in
          </Button>
          <Button
            type="button"
            variant="outline"
            isDisabled={busy}
            onPress={() => void emailAuth("up")}
          >
            <Icon name="plus" size={15} />
            Create account
          </Button>
        </div>
      </form>
    </div>
  );
}
