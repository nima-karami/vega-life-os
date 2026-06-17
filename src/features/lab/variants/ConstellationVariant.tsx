import { useMemo } from "react";
import { useStore } from "@/core/store";
import { spectrum as SPECTRUM } from "@/core/theme/tokens";
import { goalsForValue } from "@/features/goals";

const W = 1280,
  H = 720;

interface Star {
  x: number;
  y: number;
  r: number;
  o: number;
}

export function ConstellationVariant() {
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const habits = useStore((s) => s.habits);

  const bgStars = useMemo<Star[]>(() => {
    const rng = mulberry(99);
    return Array.from({ length: 150 }, () => ({
      x: rng() * W,
      y: rng() * H,
      r: rng() * 1.2 + 0.2,
      o: rng() * 0.6 + 0.15,
    }));
  }, []);

  const { nodes, links } = useMemo(() => {
    const nodes: {
      id: string;
      x: number;
      y: number;
      label: string;
      color: string;
      kind: "value" | "child";
      energy: number;
    }[] = [];
    const links: { x1: number; y1: number; x2: number; y2: number; color: string }[] = [];
    const cx = W / 2,
      cy = H / 2;
    const ring = 230;
    values.forEach((v, i) => {
      const a = (i / values.length) * Math.PI * 2 - Math.PI / 2;
      const vx = cx + Math.cos(a) * ring;
      const vy = cy + Math.sin(a) * ring * 0.74;
      const color = SPECTRUM[v.spectrum] ?? "#9aa";
      nodes.push({ id: v.id, x: vx, y: vy, label: v.name, color, kind: "value", energy: v.energy });
      const kids = [
        ...goalsForValue(goals, v.id).map((g) => ({ id: g.id, label: g.name, e: g.progress })),
        ...habits
          .filter((h) => h.valueId === v.id)
          .map((h) => ({ id: h.id, label: h.name, e: 0.5 })),
      ];
      kids.forEach((k, ki) => {
        const ka = a + (ki - (kids.length - 1) / 2) * 0.42;
        const kr = 95 + (ki % 2) * 34;
        const kx = vx + Math.cos(ka) * kr;
        const ky = vy + Math.sin(ka) * kr;
        nodes.push({ id: k.id, x: kx, y: ky, label: k.label, color, kind: "child", energy: k.e });
        links.push({ x1: vx, y1: vy, x2: kx, y2: ky, color });
      });
      // link values together in a loose ring
      if (i > 0) {
        const prev = values[i - 1];
        const pa = ((i - 1) / values.length) * Math.PI * 2 - Math.PI / 2;
        links.push({
          x1: vx,
          y1: vy,
          x2: cx + Math.cos(pa) * ring,
          y2: cy + Math.sin(pa) * ring * 0.74,
          color: "rgba(200,205,230,0.18)",
        });
        void prev;
      }
    });
    return { nodes, links };
  }, [values, goals, habits]);

  return (
    <div
      className="absolute inset-0"
      style={{ background: "radial-gradient(circle at 50% 40%, #10131f 0%, #07070c 70%)" }}
    >
      <style>{`@keyframes tw { 0%,100%{opacity:.35} 50%{opacity:1} }`}</style>
      <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" aria-hidden="true">
        {bgStars.map((s, i) => (
          <circle
            key={`star-${s.x}-${s.y}`}
            cx={s.x}
            cy={s.y}
            r={s.r}
            fill="#cdd3e8"
            opacity={s.o}
            style={{ animation: `tw ${3 + (i % 5)}s ease-in-out ${i % 7}s infinite` }}
          />
        ))}
        {links.map((l) => (
          <line
            key={`link-${l.x1}-${l.y1}-${l.x2}-${l.y2}`}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke={l.color}
            strokeWidth={0.8}
            opacity={0.5}
          />
        ))}
        {nodes.map((n) => (
          <g key={n.id}>
            {n.kind === "value" ? (
              <>
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={5 + n.energy * 6}
                  fill={n.color}
                  opacity={0.25}
                  style={{ filter: "blur(3px)" }}
                />
                <Starburst x={n.x} y={n.y} s={5 + n.energy * 5} color={n.color} />
                <text
                  x={n.x}
                  y={n.y + 26}
                  textAnchor="middle"
                  fill="#eef0fa"
                  style={{ font: "700 14px var(--font-display)" }}
                >
                  {n.label}
                </text>
                <text
                  x={n.x}
                  y={n.y + 40}
                  textAnchor="middle"
                  fill="#8a90a8"
                  style={{ font: "9px var(--font-mono)" }}
                >
                  {Math.round(n.energy * 100)}%
                </text>
              </>
            ) : (
              <>
                <circle
                  cx={n.x}
                  cy={n.y}
                  r={2 + n.energy * 2}
                  fill="#dfe3f2"
                  opacity={0.5 + n.energy * 0.5}
                />
                <text
                  x={n.x}
                  y={n.y - 8}
                  textAnchor="middle"
                  fill="#aab0c8"
                  style={{ font: "8.5px var(--font-mono)" }}
                >
                  {n.label.length > 20 ? `${n.label.slice(0, 19)}…` : n.label}
                </text>
              </>
            )}
          </g>
        ))}
      </svg>
      <div className="pointer-events-none absolute left-5 top-4">
        <p className="mono text-[10px] tracking-[0.16em] text-[#8a90a8]">// CONSTELLATION</p>
        <h1 className="display mt-1 text-2xl text-[#eef0fa]">The shape of your life</h1>
      </div>
    </div>
  );
}

function Starburst({ x, y, s, color }: { x: number; y: number; s: number; color: string }) {
  return (
    <g stroke={color} strokeWidth={1.2}>
      <circle cx={x} cy={y} r={s * 0.5} fill={color} stroke="none" />
      <line x1={x - s * 1.8} y1={y} x2={x + s * 1.8} y2={y} opacity={0.8} />
      <line x1={x} y1={y - s * 1.8} x2={x} y2={y + s * 1.8} opacity={0.8} />
    </g>
  );
}

function mulberry(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
