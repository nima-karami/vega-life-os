/**
 * JS mirror of the CSS design tokens. Use in canvas/WebGL/Three contexts
 * where CSS custom properties aren't ergonomic. Keep in sync with index.css.
 */
export const ink = {
  paper: "#f1eee4",
  paper2: "#e9e5d9",
  paper3: "#e2ddcf",
  ink: "#18180f",
  ink2: "#2c2c22",
  ash: "#474740",
  stone: "#6f6f64",
  mist: "#94948a",
  fog: "#b6b3a7",
  void: "#0b0b08",
  void2: "#15150f",
  void3: "#1d1d15",
  signal: "#c9501e",
  good: "#2f6f3f",
} as const;

/** Value spectrum — for Map orbs, galaxy, globe, and light variants. */
export const spectrum: Record<string, string> = {
  courage: "#5b6cff",
  presence: "#2bb6a8",
  selfcare: "#d8744f",
  stability: "#c2a14e",
  vitality: "#b154c9",
};

/** Monochrome hue ramp used by the B&W cockpit (matches data.jsx hues). */
export const mono = {
  courage: "#1f1f19",
  presence: "#474740",
  selfcare: "#6f6f64",
  stability: "#94948a",
  vitality: "#8a8a80",
} as const;

export const font = {
  mono: '"JetBrains Mono", ui-monospace, monospace',
  display: '"Space Grotesk", system-ui, sans-serif',
} as const;
