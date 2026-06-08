import { useRef } from "react";
import { useStore } from "@/core/store";
import { cx, Panel, SectionHead, Label, Button, Icon } from "@/core/ui";

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

      {/* identity */}
      <Panel className="mb-4 p-5">
        <SectionHead title="operator identity" />
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Labeled label="name">
            <input value={s.operatorName} onChange={(e) => s.setOperatorName(e.target.value)}
              className="mono w-full bg-transparent text-[14px] outline-none" placeholder="Your name" />
          </Labeled>
          <Labeled label="workspace">
            <input value={s.operatorWorkspace} onChange={(e) => s.setOperatorWorkspace(e.target.value)}
              className="mono w-full bg-transparent text-[14px] outline-none" placeholder="Workspace label" />
          </Labeled>
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
