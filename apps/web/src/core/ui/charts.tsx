import { useEffect, useId, useState } from "react";
import { cx } from "./cx";

// Tracks the user's reduced-motion preference (SSR-safe, live-updating).
function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduced;
}

/** ●●●●●○○○○○ discrete meter (matches the cockpit VALUES rows). */
export function DotMeter({
  value,
  count = 10,
  size = 7,
  className,
}: {
  value: number;
  count?: number;
  size?: number;
  className?: string;
}) {
  const filled = Math.round(value * count);
  const dots = Array.from({ length: count }, (_, i) => ({ on: i < filled, key: `dot-${i}` }));
  return (
    <span className={cx("inline-flex items-center gap-[3px]", className)}>
      {dots.map((dot) => (
        <span
          key={dot.key}
          className="rounded-full"
          style={{
            width: size,
            height: size,
            background: dot.on ? "var(--color-ink)" : "transparent",
            border: dot.on ? "none" : "1px solid var(--color-line-strong)",
          }}
        />
      ))}
    </span>
  );
}

/** Thin horizontal progress bar with a draggable-looking knob. */
export function ProgressBar({
  value,
  knob,
  className,
}: {
  value: number;
  knob?: boolean;
  className?: string;
}) {
  const pct = Math.min(100, Math.max(0, value * 100));
  return (
    <div className={cx("relative h-px w-full bg-[var(--color-line-strong)]", className)}>
      <div className="absolute left-0 top-0 h-px bg-ink" style={{ width: `${pct}%` }} />
      {knob && (
        <span
          className="absolute top-1/2 h-2.5 w-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink"
          style={{ left: `${pct}%` }}
        />
      )}
    </div>
  );
}

/** SVG sparkline. */
export function Sparkline({
  points,
  width = 240,
  height = 48,
  className,
  dot = true,
  color = "var(--color-ink)",
}: {
  points: number[];
  width?: number;
  height?: number;
  className?: string;
  dot?: boolean;
  /** Line/dot color — defaults to ink; pass the calm primary for a quieter trend. */
  color?: string;
}) {
  if (points.length < 2) return null;
  const max = Math.max(...points, 1);
  const min = Math.min(...points, 0);
  const range = max - min || 1;
  const dx = width / (points.length - 1);
  const xy = points.map((p, i) => [i * dx, height - ((p - min) / range) * (height - 6) - 3]);
  const d = xy.map(([x, y], i) => `${i ? "L" : "M"}${x.toFixed(1)} ${y.toFixed(1)}`).join(" ");
  const [lx, ly] = xy[xy.length - 1];
  return (
    <svg
      width={width}
      height={height}
      className={className}
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path d={d} fill="none" stroke={color} strokeWidth={1.5} />
      {dot && <circle cx={lx} cy={ly} r={2.6} fill={color} />}
    </svg>
  );
}

interface Blip {
  angle: number; // 0..1 around the circle
  radius: number; // 0..1 from center
  on?: boolean;
}

/** Orbit radar — concentric rings + sweep + blips. */
export function Radar({
  size = 200,
  blips = [],
  sweep = true,
}: {
  size?: number;
  blips?: Blip[];
  sweep?: boolean;
}) {
  const cxp = size / 2;
  const id = useId();
  const reducedMotion = usePrefersReducedMotion();
  const animateSweep = sweep && !reducedMotion;
  const rings = [0.28, 0.6, 0.92];
  return (
    <svg width={size} height={size} className="overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={`sweep-${id}`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stopColor="var(--color-ink)" stopOpacity="0" />
          <stop offset="100%" stopColor="var(--color-ink)" stopOpacity="0.14" />
        </linearGradient>
      </defs>
      {rings.map((r) => (
        <circle
          key={r}
          cx={cxp}
          cy={cxp}
          r={(size / 2) * r}
          fill="none"
          stroke="var(--color-line)"
        />
      ))}
      <line x1={cxp} y1={4} x2={cxp} y2={size - 4} stroke="var(--color-line-soft)" />
      <line x1={4} y1={cxp} x2={size - 4} y2={cxp} stroke="var(--color-line-soft)" />
      {sweep && (
        <g style={{ transformOrigin: "center" }}>
          <path
            d={`M${cxp} ${cxp} L${cxp} 4 A${cxp - 4} ${cxp - 4} 0 0 1 ${size - 4} ${cxp} Z`}
            fill={`url(#sweep-${id})`}
          >
            {animateSweep && (
              <animateTransform
                attributeName="transform"
                type="rotate"
                from={`0 ${cxp} ${cxp}`}
                to={`360 ${cxp} ${cxp}`}
                dur="6s"
                repeatCount="indefinite"
              />
            )}
          </path>
        </g>
      )}
      {blips.map((b) => {
        const a = b.angle * Math.PI * 2 - Math.PI / 2;
        const rad = (size / 2 - 8) * b.radius;
        const x = cxp + Math.cos(a) * rad;
        const y = cxp + Math.sin(a) * rad;
        return (
          <circle
            key={`blip-${b.angle}-${b.radius}`}
            cx={x}
            cy={y}
            r={b.on ? 3 : 2.4}
            fill={b.on ? "var(--color-ink)" : "none"}
            stroke="var(--color-ink)"
            strokeWidth={1}
          />
        );
      })}
    </svg>
  );
}
