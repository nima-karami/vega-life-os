import { Button } from "@heroui/react";
import { useRef, useState } from "react";
import { useStore } from "@/core/store";
import { ConfirmDialog, cx, Icon } from "@/core/ui";
import { AccountSettings } from "./components/AccountSettings";
import { AgentSettings } from "./components/AgentSettings";
import { CalendarSettings } from "./components/CalendarSettings";
import { QuietModeSettings } from "./components/QuietModeSettings";
import { SettingsCard } from "./SettingsCard";

const FIELD =
  "w-full rounded-[12px] border border-border bg-surface px-3 py-2 text-[16px] text-foreground outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent sm:text-sm";

// Curated accents, each ≥4.5:1 (WCAG AA) against its computed on-accent foreground.
// Default's hex is "" — it clears overrides so the CSS slate default shows through;
// its swatch is painted from the fixed slate below, never the live accent var.
const DEFAULT_ACCENT_HEX = "#4e6e8e";

const ACCENTS = [
  { name: "Default", hex: "" },
  { name: "Blue", hex: "#2563eb" },
  { name: "Emerald", hex: "#047857" },
  { name: "Amber", hex: "#d97706" },
  { name: "Rose", hex: "#e11d48" },
  { name: "Violet", hex: "#7c3aed" },
];

export function SettingsPage() {
  const state = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);
  const signedIn = state.authUid != null;
  const [confirmDelete, setConfirmDelete] = useState(false);

  // downscale to a 256px square data-URL so the avatar stays tiny in localStorage
  const setAvatar = async (file: File) => {
    try {
      const bitmap = await createImageBitmap(file);
      const SIZE = 256;
      const canvas = document.createElement("canvas");
      canvas.width = SIZE;
      canvas.height = SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      const scale = Math.max(SIZE / bitmap.width, SIZE / bitmap.height);
      const w = bitmap.width * scale;
      const h = bitmap.height * scale;
      ctx.drawImage(bitmap, (SIZE - w) / 2, (SIZE - h) / 2, w, h);
      state.setOperatorAvatar(canvas.toDataURL("image/jpeg", 0.85));
      state.pushToast("Photo updated");
    } catch {
      state.pushToast("Couldn't read that image");
    }
  };

  const doExport = () => {
    const blob = new Blob([state.exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vega-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    state.pushToast("Backup downloaded");
  };

  const doImport = async (file: File) => {
    const text = await file.text();
    const ok = await state.importJSON(text);
    state.pushToast(ok ? "Data restored from backup" : "Import failed: bad file");
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Settings</h1>
        <p className="mt-1 text-sm text-muted">Identity, appearance, and your data.</p>
      </header>

      <div className="mt-6 flex flex-col gap-4">
        <AccountSettings />

        {/* identity / profile */}
        <SettingsCard title="Operator profile">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
            {/* avatar */}
            <div className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => avatarRef.current?.click()}
                aria-label="Upload photo"
                className="group relative grid h-24 w-24 place-items-center overflow-hidden rounded-full border border-border bg-surface-secondary outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2"
              >
                {state.operatorAvatar ? (
                  <img src={state.operatorAvatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="text-3xl font-semibold text-muted">
                    {initials(state.operatorName)}
                  </span>
                )}
                <span className="absolute inset-0 grid place-items-center bg-foreground/50 opacity-0 transition-opacity group-hover:opacity-100">
                  <Icon name="upload" size={20} className="text-background" />
                </span>
              </button>
              <input
                ref={avatarRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void setAvatar(f);
                  e.target.value = "";
                }}
              />
              {state.operatorAvatar ? (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-xs text-muted"
                  onPress={() => state.setOperatorAvatar("")}
                >
                  Remove
                </Button>
              ) : (
                <span className="text-xs text-muted">click to upload</span>
              )}
            </div>
            {/* fields */}
            <div className="grid flex-1 gap-4 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">Name</span>
                <input
                  value={state.operatorName}
                  onChange={(e) => state.setOperatorName(e.target.value)}
                  placeholder="Your name"
                  className={FIELD}
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-sm font-medium text-foreground">Email</span>
                <input
                  type="email"
                  value={state.operatorEmail}
                  onChange={(e) => state.setOperatorEmail(e.target.value)}
                  placeholder="you@example.com"
                  readOnly={signedIn}
                  className={cx(FIELD, signedIn && "opacity-70")}
                />
                {signedIn && <span className="text-xs text-muted">Your account email.</span>}
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-sm font-medium text-foreground">Workspace</span>
                <input
                  value={state.operatorWorkspace}
                  onChange={(e) => state.setOperatorWorkspace(e.target.value)}
                  placeholder="Workspace label"
                  className={FIELD}
                />
              </label>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-sm font-medium text-foreground">Partner name</span>
                <input
                  value={state.partnerName}
                  onChange={(e) => state.setPartnerName(e.target.value)}
                  placeholder="Their name"
                  className={FIELD}
                />
                <span className="text-xs text-muted">Used on Finance's settlement screens.</span>
              </label>
            </div>
          </div>
        </SettingsCard>

        {/* appearance */}
        <SettingsCard title="Appearance">
          <div className="space-y-6">
            <div>
              <span className="text-sm font-medium text-foreground">Accent</span>
              <p className="mt-1 text-xs text-muted">
                Sets the app's primary color: buttons, highlights, the calendar now-line, and other
                accents.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {ACCENTS.map((a) => {
                  const active = state.accent === a.hex;
                  return (
                    <button
                      type="button"
                      key={a.name}
                      onClick={() => state.setAccent(a.hex)}
                      title={a.name}
                      aria-pressed={active}
                      className={cx(
                        "flex items-center gap-2 rounded-[12px] border px-2.5 py-2 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2",
                        active ? "border-accent" : "border-border hover:border-muted",
                      )}
                    >
                      <span
                        className="h-4 w-4 rounded-full border border-border"
                        style={{ background: a.hex || DEFAULT_ACCENT_HEX }}
                      />
                      <span className="text-xs text-foreground">{a.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </SettingsCard>

        <QuietModeSettings />

        <AgentSettings />

        {/* data */}
        <SettingsCard
          title="Data"
          description={
            signedIn
              ? "Synced to your account (cloud). This device keeps no local copy."
              : "Exploring locally on this device. This data is not synced."
          }
        >
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onPress={doExport}>
              <Icon name="chart" size={15} />
              Export backup (.json)
            </Button>
            <Button variant="secondary" onPress={() => fileRef.current?.click()}>
              <Icon name="plus" size={15} />
              Import backup
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void doImport(f);
                e.target.value = "";
              }}
            />
            {!signedIn && (
              <Button
                variant="secondary"
                onPress={() => {
                  void state.resetDemo();
                  state.pushToast("Demo data reset");
                }}
              >
                <Icon name="repeat" size={15} />
                Reset demo data
              </Button>
            )}
            {!signedIn && (
              <Button variant="ghost" onPress={() => state.setOnboarded(false)}>
                <Icon name="spark" size={15} />
                Replay welcome
              </Button>
            )}
            <Button variant="danger-soft" onPress={() => setConfirmDelete(true)}>
              <Icon name="trash" size={15} />
              {signedIn ? "Delete all my data" : "Delete all (this device)"}
            </Button>
          </div>
        </SettingsCard>

        <CalendarSettings />

        {/* about */}
        <SettingsCard title="About">
          <div className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
            <Row k="Version" v="0.1.0" />
            <Row k="Storage" v={signedIn ? "Cloud (your account)" : "This device (sample data)"} />
            <Row k="Command bar" v="⌘K · local agent" />
            <Row k="Cloud sync" v={signedIn ? "Connected" : "Sign in to enable"} />
          </div>
          <p className="mt-4 text-xs leading-relaxed text-muted">
            Cross-device sync is live when you sign in. Live AI and Google Calendar import are
            architected behind swappable adapters. Drop in keys to enable.
          </p>
        </SettingsCard>
        <ConfirmDialog
          open={confirmDelete}
          title={
            state.authUid ? "Delete all your account data?" : "Delete all data on this device?"
          }
          body={
            <span>
              This permanently removes {state.authUid ? "your account's" : "this device's"} values,
              goals, habits, tasks, and journal. This can't be undone.{" "}
              <button type="button" className="text-accent underline" onClick={doExport}>
                Export a backup first
              </button>
              .
            </span>
          }
          confirmLabel="Delete everything"
          danger
          onConfirm={() => {
            void state.deleteAllData();
            setConfirmDelete(false);
            state.pushToast("All data deleted");
          }}
          onClose={() => setConfirmDelete(false)}
        />
      </div>
    </div>
  );
}

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

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-sm text-muted">{k}</span>
      <span className="text-sm text-foreground">{v}</span>
    </div>
  );
}
