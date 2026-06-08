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

  theme: ThemeMode;
  setTheme: (t: ThemeMode) => void;
  toggleTheme: () => void;

  /** global goal focus filter (used by calendar / cockpit) */
  focusGoalId: string | null;
  setFocusGoal: (id: string | null) => void;

  ephemeral: EphemeralView | null;
  setEphemeral: (v: EphemeralView | null) => void;

  toast: string | null;
  pushToast: (msg: string) => void;
}

const THEME_KEY = "vega.theme";
function initialTheme(): ThemeMode {
  if (typeof localStorage === "undefined") return "paper";
  const t = localStorage.getItem(THEME_KEY);
  return t === "void" || t === "paper" ? t : "paper";
}

export const createUiSlice: Slice<UiSlice> = (set, get) => ({
  commandOpen: false,
  openCommand: () => set({ commandOpen: true }),
  closeCommand: () => set({ commandOpen: false }),
  toggleCommand: () => set((s) => ({ commandOpen: !s.commandOpen })),

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
