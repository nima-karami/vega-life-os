import { RefreshCw } from "lucide-react";
import type { ComponentType } from "react";
import { setCloudProfile } from "@/core/firebase/profile";
import type { Task } from "@/features/tasks";
import type { Slice } from "./slice";

export type ThemeMode = "paper" | "void";

/** Content snapshot of a task for the calendar copy/paste flow (no id/date/time). */
export type ClipboardTask = Pick<
  Task,
  "title" | "valueId" | "goalId" | "energy" | "durationMin" | "note"
>;

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
  operatorEmail: string;
  /** data-URL of an uploaded avatar, or "" for initials */
  operatorAvatar: string;
  setOperatorName: (v: string) => void;
  setOperatorWorkspace: (v: string) => void;
  setOperatorEmail: (v: string) => void;
  setOperatorAvatar: (v: string) => void;
  /** Populate the profile from resolved auth+cloud values without writing back to the cloud. */
  hydrateProfile: (p: { name: string; email: string; avatar: string; workspace: string }) => void;

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

  /** calendar copy/paste — non-null means "paste-armed" */
  clipboardTask: ClipboardTask | null;
  copyTask: (t: Task) => void;
  clearClipboard: () => void;

  /** one-shot ⌘K → /vocab handoff; the vocab page consumes and clears it */
  pendingVocabTerm: string | null;
  setPendingVocabTerm: (term: string | null) => void;

  toast: ToastState | null;
  pushToast: (msg: string) => void;
  /** A sticky toast with a single action (e.g. the PWA "Reload" prompt). Stays until dismissed or acted on. */
  pushActionToast: (msg: string, action: ToastAction) => void;
  /** A sticky write-failure toast with a Retry action (online-first revert path). */
  pushRetryToast: (msg: string, onRetry: () => void) => void;
  dismissToast: () => void;
}

export interface ToastAction {
  label: string;
  onClick: () => void;
}

export interface ToastState {
  message: string;
  action?: ToastAction;
  sticky?: boolean;
  /** Lucide glyph shown before the message (e.g. the retry toast). */
  icon?: ComponentType<{ className?: string }>;
}

const THEME_KEY = "vega.theme";
const SETTINGS_KEY = "vega.settings";
function initialTheme(): ThemeMode {
  if (typeof localStorage === "undefined") return "paper";
  const t = localStorage.getItem(THEME_KEY);
  return t === "void" || t === "paper" ? t : "paper";
}
interface StoredSettings {
  operatorName: string;
  operatorWorkspace: string;
  operatorEmail: string;
  operatorAvatar: string;
  accent: string;
}
function readSettings(): StoredSettings {
  const def = {
    operatorName: "Operator",
    operatorWorkspace: "Personal workspace",
    operatorEmail: "",
    operatorAvatar: "",
    accent: "",
  };
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
  setOperatorName: (operatorName) => {
    writeSettings({ operatorName });
    set({ operatorName });
    if (get().authUid) void setCloudProfile({ name: operatorName });
  },
  setOperatorWorkspace: (operatorWorkspace) => {
    writeSettings({ operatorWorkspace });
    set({ operatorWorkspace });
    if (get().authUid) void setCloudProfile({ workspace: operatorWorkspace });
  },
  setOperatorEmail: (operatorEmail) => {
    writeSettings({ operatorEmail });
    set({ operatorEmail });
  },
  setOperatorAvatar: (operatorAvatar) => {
    writeSettings({ operatorAvatar });
    set({ operatorAvatar });
    if (get().authUid) void setCloudProfile({ avatar: operatorAvatar });
  },
  hydrateProfile: (p) => {
    writeSettings({
      operatorName: p.name,
      operatorEmail: p.email,
      operatorAvatar: p.avatar,
      operatorWorkspace: p.workspace,
    });
    set({
      operatorName: p.name,
      operatorEmail: p.email,
      operatorAvatar: p.avatar,
      operatorWorkspace: p.workspace,
    });
  },
  setAccent: (accent) => {
    writeSettings({ accent });
    set({ accent });
  },

  onboarded: typeof localStorage !== "undefined" && localStorage.getItem("vega.onboarded") === "1",
  setOnboarded: (v) => {
    try {
      localStorage.setItem("vega.onboarded", v ? "1" : "0");
    } catch {
      /* ignore */
    }
    set({ onboarded: v });
  },

  focusGoalId: null,
  setFocusGoal: (focusGoalId) => set({ focusGoalId }),

  ephemeral: null,
  setEphemeral: (ephemeral) => set({ ephemeral }),

  clipboardTask: null,
  copyTask: (t) =>
    set({
      clipboardTask: {
        title: t.title,
        valueId: t.valueId,
        goalId: t.goalId,
        energy: t.energy,
        durationMin: t.durationMin,
        note: t.note,
      },
    }),
  clearClipboard: () => set({ clipboardTask: null }),

  pendingVocabTerm: null,
  setPendingVocabTerm: (pendingVocabTerm) => set({ pendingVocabTerm }),

  toast: null,
  pushToast: (message) => {
    const toast: ToastState = { message };
    set({ toast });
    setTimeout(() => {
      if (get().toast === toast) set({ toast: null });
    }, 2600);
  },
  pushActionToast: (message, action) => set({ toast: { message, action, sticky: true } }),
  pushRetryToast: (message, onRetry) =>
    set({
      toast: {
        message,
        sticky: true,
        icon: RefreshCw,
        action: {
          label: "Retry",
          onClick: () => {
            get().dismissToast();
            onRetry();
          },
        },
      },
    }),
  dismissToast: () => set({ toast: null }),
});
