import { Button, Input } from "@heroui/react";
import { useRef } from "react";
import { useStore } from "@/core/store";
import { cx, Icon } from "@/core/ui";
import { AccountSettings } from "./components/AccountSettings";
import { AgentSettings } from "./components/AgentSettings";
import { CalendarSettings } from "./components/CalendarSettings";
import { SettingsCard } from "./SettingsCard";

const ACCENTS = [
  { name: "Default", hex: "" },
  { name: "Rust", hex: "#c9501e" },
  { name: "Ember", hex: "#d8744f" },
  { name: "Gold", hex: "#c2a14e" },
  { name: "Moss", hex: "#5f7d3a" },
  { name: "Teal", hex: "#2bb6a8" },
  { name: "Cobalt", hex: "#3f63d8" },
  { name: "Violet", hex: "#7a5cd8" },
];

export function SettingsPage() {
  const s = useStore();
  const fileRef = useRef<HTMLInputElement>(null);
  const avatarRef = useRef<HTMLInputElement>(null);

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
      s.setOperatorAvatar(canvas.toDataURL("image/jpeg", 0.85));
      s.pushToast("Photo updated");
    } catch {
      s.pushToast("Couldn't read that image");
    }
  };

  const doExport = () => {
    const blob = new Blob([s.exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vega-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    s.pushToast("Backup downloaded");
  };

  const doImport = async (file: File) => {
    const text = await file.text();
    const ok = await s.importJSON(text);
    s.pushToast(ok ? "Data restored from backup" : "Import failed — bad file");
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header>
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">
          Settings
        </h1>
        <p className="mt-1 font-sans text-sm text-[var(--color-muted)]">
          Identity, appearance, and your data — all of it lives on this machine.
        </p>
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
                className="group relative grid h-24 w-24 place-items-center overflow-hidden rounded-full border border-[var(--color-line)] bg-[var(--color-canvas)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
              >
                {s.operatorAvatar ? (
                  <img src={s.operatorAvatar} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="font-display text-3xl text-[var(--color-muted)]">
                    {initials(s.operatorName)}
                  </span>
                )}
                <span className="absolute inset-0 grid place-items-center bg-[var(--color-ink)]/55 opacity-0 transition-opacity group-hover:opacity-100">
                  <Icon name="upload" size={20} className="text-white" />
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
              {s.operatorAvatar ? (
                <button
                  type="button"
                  onClick={() => s.setOperatorAvatar("")}
                  className="font-sans text-xs text-[var(--color-muted)] transition-colors hover:text-[var(--color-accent)]"
                >
                  Remove
                </button>
              ) : (
                <span className="font-sans text-xs text-[var(--color-muted)]">click to upload</span>
              )}
            </div>
            {/* fields */}
            <div className="grid flex-1 gap-4 sm:grid-cols-2">
              <Input
                label="Name"
                labelPlacement="outside"
                value={s.operatorName}
                onValueChange={s.setOperatorName}
                placeholder="Your name"
                variant="bordered"
                radius="md"
              />
              <Input
                type="email"
                label="Email"
                labelPlacement="outside"
                value={s.operatorEmail}
                onValueChange={s.setOperatorEmail}
                placeholder="you@example.com"
                variant="bordered"
                radius="md"
              />
              <Input
                label="Workspace"
                labelPlacement="outside"
                value={s.operatorWorkspace}
                onValueChange={s.setOperatorWorkspace}
                placeholder="Workspace label"
                variant="bordered"
                radius="md"
                className="sm:col-span-2"
              />
            </div>
          </div>
        </SettingsCard>

        {/* appearance */}
        <SettingsCard title="Appearance">
          <div className="space-y-6">
            <div>
              <span className="font-sans text-sm font-medium text-[var(--color-ink)]">Theme</span>
              <div className="mt-2 flex gap-2">
                {(["paper", "void"] as const).map((t) => {
                  const active = s.theme === t;
                  return (
                    <button
                      type="button"
                      key={t}
                      onClick={() => s.setTheme(t)}
                      aria-pressed={active}
                      className={cx(
                        "flex items-center gap-2 rounded-[var(--radius-sm)] border px-4 py-2.5 font-sans text-sm transition-colors",
                        active
                          ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
                          : "border-[var(--color-line)] text-[var(--color-ink)] hover:border-[var(--color-line-strong)]",
                      )}
                    >
                      <Icon name={t === "paper" ? "sun" : "moon"} size={15} />
                      {t === "paper" ? "Paper" : "Void"}
                    </button>
                  );
                })}
              </div>
            </div>
            <div>
              <span className="font-sans text-sm font-medium text-[var(--color-ink)]">Accent</span>
              <p className="mt-1 font-sans text-xs text-[var(--color-muted)]">
                Tints signals: now-line, overdue, "needs you". The HUD stays monochrome by design.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                {ACCENTS.map((a) => {
                  const active = s.accent === a.hex;
                  return (
                    <button
                      type="button"
                      key={a.name}
                      onClick={() => s.setAccent(a.hex)}
                      title={a.name}
                      aria-pressed={active}
                      className={cx(
                        "flex items-center gap-2 rounded-[var(--radius-sm)] border px-2.5 py-2 transition-colors",
                        active
                          ? "border-[var(--color-accent)]"
                          : "border-[var(--color-line)] hover:border-[var(--color-line-strong)]",
                      )}
                    >
                      <span
                        className="h-4 w-4 rounded-full border border-[var(--color-line)]"
                        style={{ background: a.hex || "var(--color-accent)" }}
                      />
                      <span className="font-sans text-xs text-[var(--color-ink)]">{a.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </SettingsCard>

        <AgentSettings />

        {/* data */}
        <SettingsCard
          title="Data · local-first"
          description="Everything is stored in this browser (IndexedDB). No cloud, no account. Back up regularly — clearing site data wipes it."
        >
          <div className="flex flex-wrap gap-2">
            <Button
              variant="bordered"
              className="border-[var(--color-line)] font-sans text-[var(--color-ink)]"
              startContent={<Icon name="chart" size={15} />}
              onPress={doExport}
            >
              Export backup (.json)
            </Button>
            <Button
              variant="bordered"
              className="border-[var(--color-line)] font-sans text-[var(--color-ink)]"
              startContent={<Icon name="plus" size={15} />}
              onPress={() => fileRef.current?.click()}
            >
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
            <Button
              variant="bordered"
              className="border-[var(--color-line)] font-sans text-[var(--color-ink)]"
              startContent={<Icon name="repeat" size={15} />}
              onPress={() => {
                void s.reseed();
                s.pushToast("Demo data reset");
              }}
            >
              Reset demo data
            </Button>
            <Button
              variant="bordered"
              className="border-[var(--color-line)] font-sans text-[var(--color-ink)]"
              startContent={<Icon name="spark" size={15} />}
              onPress={() => s.setOnboarded(false)}
            >
              Replay welcome
            </Button>
          </div>
        </SettingsCard>

        <CalendarSettings />

        {/* about */}
        <SettingsCard title="About">
          <div className="grid gap-px overflow-hidden rounded-[var(--radius-sm)] border border-[var(--color-line)] sm:grid-cols-2">
            <Row k="Version" v="0.1.0" />
            <Row k="Storage" v="IndexedDB (local)" />
            <Row k="Command bar" v="⌘K · local agent" />
            <Row k="Cloud sync" v="not connected" />
          </div>
          <p className="mt-3 font-sans text-xs leading-relaxed text-[var(--color-muted)]">
            Live AI, Google Calendar import, and cross-device sync are architected behind swappable
            adapters — drop in keys to enable. See HANDOFF.md.
          </p>
        </SettingsCard>
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
    <div className="flex items-center justify-between gap-3 bg-[var(--color-surface)] px-3 py-2.5">
      <span className="font-sans text-sm text-[var(--color-muted)]">{k}</span>
      <span className="font-mono text-xs text-[var(--color-ink)]">{v}</span>
    </div>
  );
}
