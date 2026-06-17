import { format } from "date-fns";
import { minutesOf, todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";

const INK = "#dbe6ff";
const LINE = "rgba(190,215,255,0.4)";
const FAINT = "rgba(190,215,255,0.16)";
const BG = "#0b2447";

const X0 = 130,
  X1 = 1150,
  AXIS_Y = 250;
const START = 5 * 60,
  END = 23 * 60;
const xOf = (min: number) => X0 + ((min - START) / (END - START)) * (X1 - X0);

export function BlueprintVariant() {
  const tasks = useStore((s) => s.tasks);
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);

  const today = tasks
    .filter((t) => t.date === todayISO() && t.time)
    .sort((a, b) => minutesOf(a.time ?? "") - minutesOf(b.time ?? ""));

  return (
    <div className="absolute inset-0 overflow-auto" style={{ background: BG }}>
      <svg
        viewBox="0 0 1280 720"
        className="h-full w-full"
        style={{ minHeight: 520 }}
        aria-hidden="true"
      >
        <defs>
          <pattern id="bpgrid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M32 0H0V32" fill="none" stroke={FAINT} strokeWidth="0.5" />
          </pattern>
        </defs>
        <rect width="1280" height="720" fill="url(#bpgrid)" />
        {/* frame */}
        <rect x="24" y="24" width="1232" height="672" fill="none" stroke={LINE} strokeWidth="1.5" />
        <rect x="34" y="34" width="1212" height="652" fill="none" stroke={FAINT} />

        {/* header */}
        <text
          x="56"
          y="78"
          fill={INK}
          style={{ font: "700 30px var(--font-display)", letterSpacing: "-0.02em" }}
        >
          TODAY · SCHEMATIC
        </text>
        <text
          x="56"
          y="100"
          fill={INK}
          opacity="0.6"
          style={{ font: "11px var(--font-mono)", letterSpacing: "0.16em" }}
        >
          VEGA LIFE.OS — DAY SHEET — {format(new Date(), "EEE dd MMM yyyy").toUpperCase()}
        </text>

        {/* time axis */}
        <line x1={X0} y1={AXIS_Y} x2={X1} y2={AXIS_Y} stroke={INK} strokeWidth="1" />
        {Array.from({ length: 19 }, (_, i) => 5 + i).map((h) => {
          const x = xOf(h * 60);
          return (
            <g key={h}>
              <line x1={x} y1={AXIS_Y - 6} x2={x} y2={AXIS_Y + 6} stroke={LINE} />
              <line x1={x} y1={AXIS_Y + 6} x2={x} y2={620} stroke={FAINT} strokeDasharray="2 5" />
              {h % 2 === 1 && (
                <text
                  x={x}
                  y={AXIS_Y - 12}
                  fill={INK}
                  opacity="0.7"
                  textAnchor="middle"
                  style={{ font: "9px var(--font-mono)" }}
                >
                  {String(h).padStart(2, "0")}:00
                </text>
              )}
            </g>
          );
        })}

        {/* task blocks + callouts */}
        {today.map((t, i) => {
          const x = xOf(minutesOf(t.time ?? ""));
          const w = Math.max((t.durationMin / (END - START)) * (X1 - X0), 14);
          const resolved = t.status === "done" || t.status === "skip";
          const cy = AXIS_Y + 40 + (i % 6) * 58;
          return (
            <g key={t.id}>
              <line x1={x} y1={AXIS_Y} x2={x} y2={cy} stroke={LINE} strokeDasharray="3 3" />
              <rect
                x={x}
                y={cy}
                width={w}
                height="20"
                fill={resolved ? FAINT : "none"}
                stroke={INK}
                strokeWidth="1"
              />
              {/* dimension line */}
              <line x1={x} y1={cy + 28} x2={x + w} y2={cy + 28} stroke={LINE} />
              <line x1={x} y1={cy + 25} x2={x} y2={cy + 31} stroke={LINE} />
              <line x1={x + w} y1={cy + 25} x2={x + w} y2={cy + 31} stroke={LINE} />
              <text
                x={x + w + 8}
                y={cy + 14}
                fill={INK}
                style={{ font: "12px var(--font-mono)" }}
                opacity={resolved ? 0.5 : 1}
              >
                {t.title}
                {resolved ? "  ✓" : ""}
              </text>
              <text
                x={x + w / 2}
                y={cy + 41}
                fill={INK}
                opacity="0.55"
                textAnchor="middle"
                style={{ font: "8px var(--font-mono)" }}
              >
                {t.durationMin}m
              </text>
              <text
                x={x}
                y={cy - 5}
                fill={INK}
                opacity="0.7"
                style={{ font: "8px var(--font-mono)" }}
              >
                {t.time}
              </text>
            </g>
          );
        })}

        {/* value dials (right) */}
        <text
          x="980"
          y="100"
          fill={INK}
          opacity="0.6"
          style={{ font: "10px var(--font-mono)", letterSpacing: "0.16em" }}
        >
          VALUE GAUGES
        </text>
        {values.map((v, i) => {
          const cx = 1000 + (i % 3) * 80;
          const cyy = 140 + Math.floor(i / 3) * 80;
          const a = Math.PI * (0.75 + v.energy * 1.5);
          return (
            <g key={v.id}>
              <circle cx={cx} cy={cyy} r="26" fill="none" stroke={LINE} />
              {Array.from({ length: 11 }, (_, k) => {
                const ta = Math.PI * (0.75 + (k / 10) * 1.5);
                return (
                  <line
                    key={`${v.id}-tick-${ta}`}
                    x1={cx + Math.cos(ta) * 22}
                    y1={cyy + Math.sin(ta) * 22}
                    x2={cx + Math.cos(ta) * 26}
                    y2={cyy + Math.sin(ta) * 26}
                    stroke={FAINT}
                  />
                );
              })}
              <line
                x1={cx}
                y1={cyy}
                x2={cx + Math.cos(a) * 20}
                y2={cyy + Math.sin(a) * 20}
                stroke={INK}
                strokeWidth="1.5"
              />
              <circle cx={cx} cy={cyy} r="2" fill={INK} />
              <text
                x={cx}
                y={cyy + 40}
                fill={INK}
                opacity="0.7"
                textAnchor="middle"
                style={{ font: "8px var(--font-mono)" }}
              >
                {v.name.slice(0, 7).toUpperCase()}
              </text>
            </g>
          );
        })}

        {/* title block bottom-right */}
        <g>
          <rect x="980" y="600" width="276" height="86" fill="none" stroke={INK} />
          <line x1="980" y1="628" x2="1256" y2="628" stroke={LINE} />
          <line x1="1120" y1="600" x2="1120" y2="686" stroke={LINE} />
          <text x="992" y="620" fill={INK} style={{ font: "700 13px var(--font-display)" }}>
            VEGA · LIFE.OS
          </text>
          <text x="992" y="648" fill={INK} opacity="0.7" style={{ font: "9px var(--font-mono)" }}>
            SHEET
          </text>
          <text x="992" y="670" fill={INK} style={{ font: "700 18px var(--font-display)" }}>
            01 / TODAY
          </text>
          <text x="1132" y="648" fill={INK} opacity="0.7" style={{ font: "9px var(--font-mono)" }}>
            SCALE
          </text>
          <text x="1132" y="670" fill={INK} style={{ font: "700 18px var(--font-display)" }}>
            1 : 1
          </text>
        </g>
        <text
          x="56"
          y="676"
          fill={INK}
          opacity="0.5"
          style={{ font: "9px var(--font-mono)", letterSpacing: "0.16em" }}
        >
          {goals.length} GOALS · {values.length} VALUES · {today.length} BLOCKS TODAY
        </text>
      </svg>
    </div>
  );
}
