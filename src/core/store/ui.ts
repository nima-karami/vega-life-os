import type { Slice } from "./slice";

export type ThemeMode = "paper" | "void";

/** An on-the-fly view the agent can conjure for a query the fixed views don't cover. */
export interface EphemeralView {
  title: string;
  subtitle?: string;
  /** task ids to render as a focused list, if any */
  taskIds?: string[];
  /** freeform lines to render */
  lines?: string[];
  createdAt: number;
}

export interface UiSlice {
  commandOpen: boolean;
  openCommand: () => void;
  closeCommand: () => void;
  toggleCommand: () => void;

  shortcutsOpen: boolean;
  setShortcutsOpen: (v: boolean) => void;

  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;

  /** operator identity (shown across the HUD) */
  operatorName: string;
  operatorWorkspace: string;
  setOperatorName: (v: string) => void;
  setOperatorWorkspace: (v: string) => void;

  /** custom accent — tints signal/needs-you/now-line; "" = theme default */
  accent: string;
  setAccent: (hex: string) => void;

  /** first-run welcome completed */
  onboarded: boolean;
  setOnboarded: (v: boolean) => void;

  /** global goal focus filter (used by calendar / cockpit) */
  focusGoalId: string | null;
  setFocusGoal: (id: string | null) => void;

  ephemeral: EphemeralView | null;
  setEphemeral: (v: EphemeralView | null) => void;

  toast: string | null;
  pushToast: (msg: string) => void;
}

const THEME_KEY = "vega.theme";
const SETTINGS_KEY = "vega.settings";
function initialTheme(): ThemeMode {
  if (typeof localStorage === "undefined") return "paper";
  const t = localStorage.getItem(THEME_KEY);
  return t === "void" || t === "paper" ? t : "paper";
}
interface StoredSettings { operatorName: string; operatorWorkspace: string; accent: string }
function readSettings(): StoredSettings {
  const def = { operatorName: "Operator", operatorWorkspace: "Personal workspace", accent: "" };
  if (typeof localStorage === "undefined") return def;
  try {
    return { ...def, ...JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "{}") };
  } catch {
    return def;
  }
}
function writeSettings(s: Partial<StoredSettings>) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...readSettings(), ...s }));
  } catch {
    /* ignore */
  }
}

export const createUiSlice: Slice<UiSlice> = (set, get) => ({
  commandOpen: false,
  openCommand: () => set({ commandOpen: true }),
  closeCommand: () => set({ commandOpen: false }),
  toggleCommand: () => set((s) => ({ commandOpen: !s.commandOpen })),

  shortcutsOpen: false,
  setShortcutsOpen: (shortcutsOpen) => set({ shortcutsOpen }),

  theme: initialTheme(),
  setTheme: (theme) => {
    try {
      localStorage.setItem(THEME_KEY, theme);
    } catch {
      /* ignore */
    }
    set({ theme });
  },
  toggleTheme: () => get().setTheme(get().theme === "paper" ? "void" : "paper"),

  ...(() => readSettings())(),
  setOperatorName: (operatorName) => { writeSettings({ operatorName }); set({ operatorName }); },
  setOperatorWorkspace: (operatorWorkspace) => { writeSettings({ operatorWorkspace }); set({ operatorWorkspace }); },
  setAccent: (accent) => { writeSettings({ accent }); set({ accent }); },

  onboarded: typeof localStorage !== "undefined" && localStorage.getItem("vega.onboarded") === "1",
  setOnboarded: (v) => {
    try { localStorage.setItem("vega.onboarded", v ? "1" : "0"); } catch { /* ignore */ }
    set({ onboarded: v });
  },

  focusGoalId: null,
  setFocusGoal: (focusGoalId) => set({ focusGoalId }),

  ephemeral: null,
  setEphemeral: (ephemeral) => set({ ephemeral }),

  toast: null,
  pushToast: (toast) => {
    set({ toast });
    setTimeout(() => {
      if (get().toast === toast) set({ toast: null });
    }, 2600);
  },
});
