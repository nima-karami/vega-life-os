/**
 * Command / nav registry — the sole navigation layer for the vapor redesign.
 *
 * Provides:
 * - NAV_COMMANDS: the 5 v1 routes (Today, Values, Habits, Calendar, Analytics)
 * - ACTION_COMMANDS: core shell actions (add task, reset demo, keyboard shortcuts)
 * - registerCommands / useRegisterCommands: API for views to add per-view commands
 */

import { useEffect } from "react";
import type { IconName } from "@/core/lib/icon-names";
import type { useStore } from "@/core/store";
import { buildNewCardPath } from "@/features/cards/draft-prefill";

/** What a command's run() callback receives. */
export interface CommandApi {
  navigate: (to: string) => void;
  close: () => void;
  store: typeof useStore;
  query: string;
}

/** A navigation entry (routes to a path). */
export interface NavCommand {
  id: string;
  label: string;
  sublabel?: string;
  icon: IconName;
  to: string;
  keywords?: string;
}

/** An executable action. */
export interface ActionCommand {
  id: string;
  label: string;
  icon: IconName;
  keywords?: string;
  run: (api: CommandApi) => void;
}

export const NAV_COMMANDS: NavCommand[] = [
  {
    id: "nav-today",
    label: "Today",
    sublabel: "Focus · daily plan",
    icon: "calendar",
    to: "/today",
    keywords: "today focus daily plan tasks",
  },
  {
    id: "nav-values",
    label: "Values & Goals",
    sublabel: "The why",
    icon: "tree",
    to: "/values",
    keywords: "values goals the why",
  },
  {
    id: "nav-habits",
    label: "Habits",
    sublabel: "Recurrence",
    icon: "repeat",
    to: "/habits",
    keywords: "habits recurrence streak",
  },
  {
    id: "nav-calendar",
    label: "Calendar",
    sublabel: "Week · schedule",
    icon: "calendar",
    to: "/calendar",
    keywords: "calendar week schedule gcal",
  },
  {
    id: "nav-analytics",
    label: "Analytics",
    sublabel: "Patterns & review",
    icon: "chart",
    to: "/analytics",
    keywords: "analytics review follow-through insights",
  },
  {
    id: "nav-entries",
    label: "Entries",
    sublabel: "Journal · gratitude log",
    icon: "notebook-pen",
    to: "/entries",
    keywords: "entries journal gratitude mood log history past",
  },
  {
    id: "nav-brainwrite",
    label: "BrainWrite",
    sublabel: "Flashcards · spaced repetition",
    icon: "brain",
    to: "/brainwrite",
    // The retired scroll's keywords ride along so old muscle memory still lands here.
    keywords:
      "brainwrite study flashcards spaced repetition leitner grade swipe review learn scroll feed mind",
  },
  {
    id: "nav-cards",
    label: "Cards",
    sublabel: "BrainWrite · deck",
    icon: "layers",
    to: "/cards",
    // Vocabulary folded into the deck, so its words are found from this one entry.
    keywords: "cards deck flashcards manage vocab words dictionary language vocabulary terms",
  },
  // Finance is one door: reachable from here only (no nav slot), and its five views are
  // reached from the strip inside the page — so the sub-routes get keywords, not entries.
  {
    id: "nav-finance",
    label: "Finance",
    sublabel: "Money · month overview",
    icon: "wallet",
    to: "/finance",
    keywords:
      "finance money spending dashboard overview transactions ledger expenses rows import statements bank csv tsv upload categories budgets limits settlement split share partner owed household",
  },
];

export const ACTION_COMMANDS: ActionCommand[] = [
  {
    id: "action-add-task",
    label: "Add task to backlog",
    icon: "plus",
    keywords: "add task new backlog",
    run: ({ store, query, close }) => {
      const title = query.trim();
      if (!title) return;
      store.getState().addTask({ title, date: null });
      store.getState().pushToast(`Added "${title}" to backlog`);
      close();
    },
  },
  {
    id: "action-shortcuts",
    label: "Keyboard shortcuts",
    icon: "command",
    keywords: "keyboard shortcuts help hotkeys",
    run: ({ store, close }) => {
      store.getState().setShortcutsOpen(true);
      close();
    },
  },
  {
    id: "action-settings",
    label: "Settings",
    icon: "sliders",
    keywords: "settings identity data backup export account",
    run: ({ navigate, close }) => {
      navigate("/settings");
      close();
    },
  },
  {
    id: "action-reseed",
    label: "Reset demo data",
    icon: "repeat",
    keywords: "reseed reset demo data",
    run: ({ store, close }) => {
      void store.getState().resetDemo();
      store.getState().pushToast("Demo data reset");
      close();
    },
  },
  {
    id: "action-add-word",
    label: "Add word",
    icon: "languages",
    keywords: "add word new vocab vocabulary term",
    run: ({ navigate, close }) => {
      navigate(buildNewCardPath("vocabulary", ""));
      close();
    },
  },
  {
    id: "action-add-expense",
    label: "Add expense",
    icon: "coins",
    keywords: "add expense spend transaction finance quick money",
    // A single free-text query can't carry amount + date + category + payer + share, so the
    // draft is stashed and the ledger's host opens the quick-add on it.
    run: ({ store, query, navigate, close }) => {
      store.getState().setPendingFinanceEntry(query.trim());
      navigate("/finance/transactions");
      close();
    },
  },
];

type RegistryListener = () => void;

let _viewCommands: ActionCommand[] = [];
const _listeners = new Set<RegistryListener>();
let _version = 0;

function notify() {
  _version++;
  for (const l of _listeners) l();
}

/**
 * Register additional commands while a view is mounted.
 * Returns an unregister function — call it on view unmount.
 * Registering a command with an existing id replaces the old one.
 */
export function registerCommands(commands: ActionCommand[]): () => void {
  // Replace existing by id or append
  const ids = new Set(commands.map((c) => c.id));
  _viewCommands = _viewCommands.filter((c) => !ids.has(c.id));
  _viewCommands = [..._viewCommands, ...commands];
  notify();
  return () => {
    _viewCommands = _viewCommands.filter((c) => !ids.has(c.id));
    notify();
  };
}

/** Subscribe to registry changes (used by CommandBar). Returns unsubscribe. */
export function subscribeRegistry(listener: RegistryListener): () => void {
  _listeners.add(listener);
  return () => _listeners.delete(listener);
}

/** Read current view commands snapshot. */
export function getViewCommands(): ActionCommand[] {
  return _viewCommands;
}

/** Get current registry version (use as a dependency trigger). */
export function getRegistryVersion(): number {
  return _version;
}

/**
 * Hook wrapper: registers commands on mount, unregisters on unmount.
 * Views import this to inject their per-view actions.
 */
export function useRegisterCommands(commands: ActionCommand[]): void {
  // biome-ignore lint/correctness/useExhaustiveDependencies: commands identity changes on every render; key on ids
  useEffect(() => {
    return registerCommands(commands);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
