import { useRef } from "react";
import { useStore } from "@/core/store";
import { cx, Panel, SectionHead, Label, Button, Icon } from "@/core/ui";
import { AccountSettings } from "./components/AccountSettings";
import { AgentSettings } from "./components/AgentSettings";

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
    <div className="mx-auto max-w-[820px] p-4">
      <Panel className="mb-4 px-5 py-4">
        <Label>// settings · console</Label>
        <h1 className="display mt-1 text-3xl">Console</h1>
        <p className="mono mt-1 text-[11px] text-stone">Identity, appearance, and your data — all of it lives on this machine.</p>
      </Panel>

      <AccountSettings />

      {/* identity / profile */}
      <Panel className="mb-4 p-5">
        <SectionHead title="operator profile" />
        <div className="mt-4 flex flex-col gap-5 sm:flex-row sm:items-start">
          {/* avatar */}
          <div className="flex flex-col items-center gap-2">
            <button onClick={() => avatarRef.current?.click()} aria-label="Upload photo"
              className="group relative grid h-24 w-24 place-items-center overflow-hidden rounded-full border border-[var(--color-line-strong)]"
              style={{ background: s.operatorAvatar ? undefined : "var(--color-paper-3)" }}>
              {s.operatorAvatar ? (
                <img src={s.operatorAvatar} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="display text-3xl text-ink/70">{initials(s.operatorName)}</span>
              )}
              <span className="absolute inset-0 grid place-items-center bg-ink/55 opacity-0 transition-opacity group-hover:opacity-100">
                <Icon name="upload" size={20} className="text-paper" />
              </span>
            </button>
            <input ref={avatarRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => { const f = e.target.files?.[0]; if (f) void setAvatar(f); e.target.value = ""; }} />
            {s.operatorAvatar ? (
              <button onClick={() => s.setOperatorAvatar("")} className="mono text-[10px] uppercase tracking-[0.1em] text-stone hover:text-signal">Remove</button>
            ) : (
              <span className="mono text-[9px] uppercase tracking-[0.1em] text-mist">click to upload</span>
            )}
          </div>
          {/* fields */}
          <div className="grid flex-1 gap-3 sm:grid-cols-2">
            <Labeled label="name">
              <input value={s.operatorName} onChange={(e) => s.setOperatorName(e.target.value)}
                className="mono w-full bg-transparent text-[14px] outline-none" placeholder="Your name" />
            </Labeled>
            <Labeled label="email">
              <input type="email" value={s.operatorEmail} onChange={(e) => s.setOperatorEmail(e.target.value)}
                className="mono w-full bg-transparent text-[14px] outline-none" placeholder="you@example.com" />
            </Labeled>
            <Labeled label="workspace">
              <input value={s.operatorWorkspace} onChange={(e) => s.setOperatorWorkspace(e.target.value)}
                className="mono w-full bg-transparent text-[14px] outline-none" placeholder="Workspace label" />
            </Labeled>
          </div>
        </div>
      </Panel>

      {/* appearance */}
      <Panel className="mb-4 p-5">
        <SectionHead title="appearance" />
        <div className="mt-4 space-y-4">
          <div>
            <Label>theme</Label>
            <div className="mt-2 flex gap-2">
              {(["paper", "void"] as const).map((t) => (
                <button key={t} onClick={() => s.setTheme(t)}
                  className={cx("mono flex items-center gap-2 border px-4 py-2.5 text-[11px] uppercase tracking-[0.1em]",
                    s.theme === t ? "border-ink bg-ink text-paper" : "border-[var(--color-line)] text-stone hover:border-ink")}>
                  <Icon name={t === "paper" ? "sun" : "moon"} size={14} />
                  {t === "paper" ? "Paper" : "Void"}
                </button>
              ))}
            </div>
          </div>
          <div>
            <Label>accent</Label>
            <p className="mono mt-1 text-[10px] text-mist">Tints signals: now-line, overdue, "needs you". The HUD stays monochrome by design.</p>
            <div className="mt-2 flex flex-wrap gap-2">
              {ACCENTS.map((a) => (
                <button key={a.name} onClick={() => s.setAccent(a.hex)} title={a.name}
                  className={cx("flex items-center gap-2 border px-2.5 py-2 transition-colors",
                    s.accent === a.hex ? "border-ink" : "border-[var(--color-line)] hover:border-ink/50")}>
                  <span className="h-4 w-4 rounded-full border border-[var(--color-line)]"
                    style={{ background: a.hex || "var(--color-mist)" }} />
                  <span className="mono text-[10px] uppercase tracking-[0.08em]">{a.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </Panel>

      <AgentSettings />

      {/* data */}
      <Panel className="mb-4 p-5">
        <SectionHead title="data · local-first" />
        <p className="mono mt-3 text-[11px] leading-relaxed text-stone">
          Everything is stored in this browser (IndexedDB). No cloud, no account. Back up regularly —
          clearing site data wipes it.
        </p>
        <div className="mt-4 flex flex-wrap gap-2">
          <Button icon="chart" onClick={doExport}>Export backup (.json)</Button>
          <Button icon="plus" onClick={() => fileRef.current?.click()}>Import backup</Button>
          <input ref={fileRef} type="file" accept="application/json" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void doImport(f); e.target.value = ""; }} />
          <Button icon="repeat" onClick={() => { void s.reseed(); s.pushToast("Demo data reset"); }}>Reset demo data</Button>
          <Button icon="spark" onClick={() => s.setOnboarded(false)}>Replay welcome</Button>
        </div>
      </Panel>

      <Panel className="p-5">
        <SectionHead title="about" />
        <div className="mt-3 grid gap-2 sm:grid-cols-2">
          <Row k="version" v="0.1.0" />
          <Row k="storage" v="IndexedDB (local)" />
          <Row k="command bar" v="⌘K · local agent" />
          <Row k="cloud sync" v="not connected" />
        </div>
        <p className="mono mt-3 text-[10px] leading-relaxed text-mist">
          Live AI, Google Calendar import, and cross-device sync are architected behind swappable
          adapters — drop in keys to enable. See HANDOFF.md.
        </p>
      </Panel>
    </div>
  );
}

function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).map((w) => w[0]).join("").slice(0, 2).toUpperCase() || "OP";
}
function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5 border border-[var(--color-line)] px-3 py-2.5">
      <Label>{label}</Label>
      {children}
    </label>
  );
}
function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between border-b border-[var(--color-line)] py-1.5">
      <Label>{k}</Label>
      <span className="mono text-[11px] text-ink">{v}</span>
    </div>
  );
}
