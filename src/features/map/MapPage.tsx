import { useMemo, useState } from "react";
import { motion } from "framer-motion";
import { useStore } from "@/core/store";
import { Panel, SectionHead, Label, Icon, Tag, Gauge } from "@/core/ui";
import { spectrum as SPECTRUM } from "@/core/theme/tokens";
import { valueRollup } from "@/features/values";
import { goalsForValue } from "@/features/goals";
import type { Value } from "@/features/values";

interface Node {
  id: string;
  kind: "value" | "goal" | "habit";
  label: string;
  sub: string;
  x: number;
  y: number;
  size: number;
  hue: string;
  energy: number;
  needsYou?: boolean;
  parentId?: string;
  icon: Parameters<typeof Icon>[0]["name"];
}

const W = 1000;
const H = 640;

export function MapPage() {
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const habits = useStore((s) => s.habits);
  const tasks = useStore((s) => s.tasks);
  const [active, setActive] = useState<string | null>(null);

  const { nodes, edges } = useMemo(() => {
    const nodes: Node[] = [];
    const edges: { x1: number; y1: number; x2: number; y2: number; faint: boolean }[] = [];
    const cx = W / 2;
    const cy = H / 2;
    const ring = Math.min(W, H) * 0.34;

    values.forEach((v, i) => {
      const a = (i / values.length) * Math.PI * 2 - Math.PI / 2;
      const vx = cx + Math.cos(a) * ring;
      const vy = cy + Math.sin(a) * ring * 0.82;
      const roll = valueRollup(v.id, { goals, habits, tasks, energy: v.energy });
      const size = 56 + v.energy * 56;
      nodes.push({
        id: v.id, kind: "value", label: v.name,
        sub: `${Math.round(v.energy * 100)}% energy`,
        x: vx, y: vy, size, hue: SPECTRUM[v.spectrum] ?? "#888",
        energy: v.energy, needsYou: roll.needsYou, icon: v.icon,
      });

      // children: goals + maintenance habits (no goal)
      const children: { id: string; label: string; sub: string; icon: Node["icon"]; energy: number; kind: "goal" | "habit" }[] = [];
      goalsForValue(goals, v.id).forEach((g) =>
        children.push({ id: g.id, label: g.name, sub: `${Math.round(g.progress * 100)}% · goal`, icon: g.icon, energy: g.progress, kind: "goal" }),
      );
      habits.filter((h) => h.valueId === v.id && !h.goalId).forEach((h) =>
        children.push({ id: h.id, label: h.name, sub: "upkeep", icon: h.icon, energy: 0.5, kind: "habit" }),
      );

      const childRing = size / 2 + 70;
      children.forEach((c, ci) => {
        const ca = a + (ci - (children.length - 1) / 2) * 0.5;
        const ccx = vx + Math.cos(ca) * childRing;
        const ccy = vy + Math.sin(ca) * childRing;
        edges.push({ x1: vx, y1: vy, x2: ccx, y2: ccy, faint: c.kind === "habit" });
        nodes.push({
          id: c.id, kind: c.kind, label: c.label, sub: c.sub,
          x: ccx, y: ccy, size: 34, hue: SPECTRUM[v.spectrum] ?? "#888",
          energy: c.energy, parentId: v.id, icon: c.icon,
        });
      });
    });
    return { nodes, edges };
  }, [values, goals, habits, tasks]);

  const activeValue = values.find((v) => v.id === active) ?? null;

  return (
    <div className="mx-auto max-w-[1400px] p-4">
      <Panel className="mb-4 px-5 py-4">
        <Label>// map · orbit view</Label>
        <h1 className="display mt-1 text-4xl">Your life, by value</h1>
        <p className="mono mt-2 max-w-xl text-[11px] leading-relaxed text-stone">
          Everything you do orbits a value. Bright clusters are getting your energy this
          week; dim ones are slipping. A flagged value needs you.
        </p>
      </Panel>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
        <Panel className="relative overflow-hidden">
          <div className="absolute left-4 top-3 z-10 flex items-center gap-3">
            <Label ink>// orbit field</Label>
            <span className="mono flex items-center gap-1 text-[9px] text-stone"><span className="inline-block h-px w-4 bg-ink" /> goal work</span>
            <span className="mono flex items-center gap-1 text-[9px] text-stone"><span className="inline-block h-px w-4 border-b border-dashed border-stone" /> upkeep</span>
          </div>
          <div className="aspect-[1000/640] w-full">
            <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full">
              {edges.map((e, i) => (
                <line key={i} x1={e.x1} y1={e.y1} x2={e.x2} y2={e.y2}
                  stroke="var(--color-line-strong)" strokeWidth={1}
                  strokeDasharray={e.faint ? "3 4" : undefined} opacity={e.faint ? 0.6 : 1} />
              ))}
              {nodes.map((n) => <NodeShape key={n.id} n={n} active={active === n.id} onClick={() => setActive(n.id === active ? null : n.id)} />)}
            </svg>
          </div>
        </Panel>

        <div className="space-y-4">
          {activeValue ? (
            <ValueCard value={activeValue} onClose={() => setActive(null)} />
          ) : (
            <Panel className="p-4">
              <SectionHead title="values" meta={String(values.length).padStart(2, "0")} />
              <div className="mt-3 space-y-2.5">
                {values.map((v) => {
                  const roll = valueRollup(v.id, { goals, habits, tasks, energy: v.energy });
                  return (
                    <button key={v.id} onClick={() => setActive(v.id)}
                      className="flex w-full items-center gap-2.5 border border-[var(--color-line)] px-2.5 py-2 text-left transition-colors hover:border-ink">
                      <span className="h-3 w-3 rounded-full" style={{ background: SPECTRUM[v.spectrum] }} />
                      <span className="flex-1">
                        <span className="display block text-[13px] leading-none">{v.name}</span>
                        <span className="mono text-[9px] text-stone">{roll.goals}G · {roll.habits}H · {Math.round(v.energy * 100)}%</span>
                      </span>
                      {roll.needsYou && <Tag><span style={{ color: "var(--color-signal)" }}>NEEDS YOU</span></Tag>}
                    </button>
                  );
                })}
              </div>
            </Panel>
          )}

          <Panel className="p-4">
            <SectionHead title="balance" meta="this week" />
            <div className="mt-3 flex items-end gap-1.5" style={{ height: 90 }}>
              {values.map((v) => (
                <div key={v.id} className="flex flex-1 flex-col items-center gap-1.5">
                  <div className="flex w-full flex-1 items-end">
                    <div className="w-full" style={{ height: `${v.energy * 100}%`, background: SPECTRUM[v.spectrum], minHeight: 2 }} />
                  </div>
                  <span className="mono text-[8px] uppercase text-stone">{v.name.slice(0, 4)}</span>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </div>
    </div>
  );
}

function NodeShape({ n, active, onClick }: { n: Node; active: boolean; onClick: () => void }) {
  const r = n.size / 2;
  const dim = 0.4 + n.energy * 0.6;
  return (
    <motion.g
      style={{ cursor: "pointer" }}
      onClick={onClick}
      initial={{ opacity: 0, scale: 0.6 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.4, delay: Math.random() * 0.2 }}
    >
      {n.kind === "value" ? (
        <>
          {n.needsYou && (
            <circle cx={n.x} cy={n.y} r={r + 7} fill="none" stroke="var(--color-signal)" strokeWidth={1} strokeDasharray="2 4" />
          )}
          <circle cx={n.x} cy={n.y} r={r} fill={n.hue} opacity={dim} stroke={active ? "var(--color-ink)" : "transparent"} strokeWidth={2} />
          <text x={n.x} y={n.y + r + 16} textAnchor="middle" className="display" style={{ fontSize: 14, fill: "var(--color-ink)" }}>{n.label}</text>
          <text x={n.x} y={n.y + r + 30} textAnchor="middle" style={{ fontSize: 9, fill: "var(--color-stone)", fontFamily: "var(--font-mono)" }}>{n.sub}</text>
        </>
      ) : (
        <>
          <circle cx={n.x} cy={n.y} r={r} fill="var(--color-paper)" stroke={n.hue} strokeWidth={1.5} opacity={0.5 + n.energy * 0.5} />
          <text x={n.x} y={n.y + r + 13} textAnchor="middle" style={{ fontSize: 9.5, fill: "var(--color-ash)", fontFamily: "var(--font-mono)" }}>
            {n.label.length > 22 ? n.label.slice(0, 21) + "…" : n.label}
          </text>
        </>
      )}
    </motion.g>
  );
}

function ValueCard({ value, onClose }: { value: Value; onClose: () => void }) {
  const goals = useStore((s) => s.goals);
  const habits = useStore((s) => s.habits);
  const tasks = useStore((s) => s.tasks);
  const roll = valueRollup(value.id, { goals, habits, tasks, energy: value.energy });
  const vGoals = goalsForValue(goals, value.id);
  return (
    <Panel ticks className="p-4">
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full" style={{ background: SPECTRUM[value.spectrum] }}>
            <Icon name={value.icon} size={16} className="text-paper" />
          </span>
          <div>
            <h3 className="display text-lg leading-none">{value.name}</h3>
            <Label className="mt-1">value</Label>
          </div>
        </div>
        <button onClick={onClose} className="text-stone hover:text-ink"><Icon name="close" size={16} /></button>
      </div>
      <p className="mono mt-3 text-[11px] leading-relaxed text-ash">{value.desc}</p>
      <div className="mt-4 flex items-center gap-4">
        <Gauge value={value.energy} size={64} sub="energy" />
        <div className="space-y-1.5">
          <Stat k="goals" v={roll.goals} />
          <Stat k="habits" v={roll.habits} />
          <Stat k="attention" v={`${Math.round(roll.attention * 100)}%`} />
        </div>
      </div>
      {vGoals.length > 0 && (
        <div className="mt-4">
          <Label>goals</Label>
          <div className="mt-1.5 space-y-1">
            {vGoals.map((g) => (
              <div key={g.id} className="flex items-center justify-between border-b border-[var(--color-line)] py-1">
                <span className="mono text-[11px] text-ink">{g.name}</span>
                <span className="mono text-[10px] text-stone">{Math.round(g.progress * 100)}%</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}

function Stat({ k, v }: { k: string; v: string | number }) {
  return (
    <div className="flex items-center gap-2">
      <span className="display text-base leading-none">{v}</span>
      <Label>{k}</Label>
    </div>
  );
}
