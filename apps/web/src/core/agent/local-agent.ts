import { format, subDays } from "date-fns";
import { todayISO } from "@/core/lib/date";
import { type RootState, useStore } from "@/core/store";
import type { Task } from "@/features/tasks/model";
import {
  buildCloseTaskAction,
  buildFocusGoalAction,
  buildPlanWeekAction,
  formatAddTaskLabel,
} from "./agent-actions";
import type { Agent, AgentAction, AgentResult } from "./types";
import { parseWhen } from "./when";

type IntentMatcher = (query: string, state: RootState) => AgentAction[];

const score = (q: string, text: string) => {
  const a = q.toLowerCase();
  const b = text.toLowerCase();
  if (b.includes(a)) return 2;
  const toks = a.split(/\s+/).filter(Boolean);
  const hit = toks.filter((t) => b.includes(t)).length;
  return toks.length ? hit / toks.length : 0;
};

const isOpenTask = (t: Task) => t.status !== "done" && t.status !== "skip";

function rankByName<T>(
  items: T[],
  needle: string,
  nameOf: (item: T) => string,
  threshold: number,
  limit: number,
): T[] {
  return items
    .map((item) => ({ item, sc: score(needle, nameOf(item)) }))
    .filter((x) => x.sc > threshold)
    .sort((a, b) => b.sc - a.sc)
    .slice(0, limit)
    .map((x) => x.item);
}

const matchAddTask: IntentMatcher = (query, state) => {
  const add = query.match(/^(?:add|new|todo|task)\s+(.+)/i);
  if (!add) return [];
  const { date, time, rest } = parseWhen(add[1]);
  return [
    {
      id: "add",
      icon: "plus",
      label: formatAddTaskLabel(rest, date, time),
      run: () => {
        state.addTask({ title: rest, date: date ?? null, time: time ?? null });
        state.pushToast(`Added "${rest}"`);
      },
    },
  ];
};

const matchCloseTask =
  (pattern: RegExp, status: "done" | "skip"): IntentMatcher =>
  (query, state) => {
    const close = query.match(pattern);
    if (!close) return [];
    return rankByName(state.tasks.filter(isOpenTask), close[1], (t) => t.title, 0.4, 3).map((t) =>
      buildCloseTaskAction(state, t, status, `${status}-${t.id}`),
    );
  };

const matchReadBook: IntentMatcher = (query, state) => {
  const read = query.match(/^(?:read|reading|book)\s+(.+)/i);
  if (!read) return [];
  return [
    {
      id: "read",
      icon: "book",
      label: `Add book: "${read[1]}"`,
      run: () => {
        state.addBook({ title: read[1], status: "reading", startedAt: todayISO() });
        state.pushToast(`Reading "${read[1]}"`);
      },
    },
  ];
};

const matchWatchFilm: IntentMatcher = (query, state) => {
  const watch = query.match(/^(?:watch|watched|film|movie)\s+(.+)/i);
  if (!watch) return [];
  return [
    {
      id: "watch",
      icon: "film",
      label: `Add film: "${watch[1]}"`,
      run: () => {
        state.addMovie({ title: watch[1], status: "queued" });
        state.pushToast(`Added "${watch[1]}" to watchlist`);
      },
    },
  ];
};

const matchPlanWeek: IntentMatcher = (query, state) => {
  const lower = query.toLowerCase();
  const isPlanWeek = /\b(plan|generate|fill).*(week)\b/i.test(lower) || lower === "plan week";
  return isPlanWeek ? [buildPlanWeekAction(state, "plan")] : [];
};

const matchFocusGoal: IntentMatcher = (query, state) => {
  const focus = query.match(/^focus\s+(.+)/i);
  if (!focus) return [];
  return rankByName(state.goals, focus[1], (g) => g.name, 0.3, 2).map((g) =>
    buildFocusGoalAction(state, g, `focus-${g.id}`, "target"),
  );
};

const showTodayQueue = (state: RootState) => {
  const ids = state.tasks
    .filter((t) => t.date === todayISO())
    .sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"))
    .map((t) => t.id);
  state.setEphemeral({
    title: "Today",
    subtitle: `${ids.length} scheduled`,
    taskIds: ids,
    createdAt: Date.now(),
  });
};

const matchTodayQuery: IntentMatcher = (query, state) =>
  /(due )?today|what.?s (on|today)/i.test(query.toLowerCase())
    ? [
        {
          id: "q-today",
          icon: "calendar",
          label: "Show: today's queue",
          run: () => showTodayQueue(state),
        },
      ]
    : [];

const showStillOpen = (state: RootState) => {
  const recent = format(subDays(new Date(), 14), "yyyy-MM-dd");
  const overdue = state.tasks
    .filter((t) => t.date && t.date >= recent && t.date < todayISO() && isOpenTask(t))
    .sort((a, b) => ((a.date ?? "") < (b.date ?? "") ? 1 : -1));
  state.setEphemeral({
    title: "Still open",
    subtitle: `${overdue.length} still open · last 14 days`,
    taskIds: overdue.map((t) => t.id),
    createdAt: Date.now(),
  });
};

const matchStillOpenQuery: IntentMatcher = (query, state) =>
  /overdue|behind|late|missed/i.test(query.toLowerCase())
    ? [
        {
          id: "q-still-open",
          icon: "alert",
          label: "Show: still-open tasks",
          run: () => showStillOpen(state),
        },
      ]
    : [];

const showBacklog = (state: RootState) => {
  const ids = state.tasks.filter((t) => t.date === null && t.status !== "done").map((t) => t.id);
  state.setEphemeral({
    title: "Backlog",
    subtitle: `${ids.length} undated`,
    taskIds: ids,
    createdAt: Date.now(),
  });
};

const matchBacklogQuery: IntentMatcher = (query, state) =>
  /backlog/i.test(query.toLowerCase())
    ? [{ id: "q-backlog", icon: "board", label: "Show: backlog", run: () => showBacklog(state) }]
    : [];

const matchValueQuery: IntentMatcher = (query, state) =>
  state.values
    .filter((v) => score(query, v.name) >= 1)
    .map((v) => ({
      id: `q-val-${v.id}`,
      icon: v.icon,
      label: `Show: ${v.name} work`,
      run: () => {
        const ids = state.tasks.filter((t) => t.valueId === v.id && isOpenTask(t)).map((t) => t.id);
        state.setEphemeral({
          title: v.name,
          subtitle: v.desc,
          taskIds: ids.slice(0, 30),
          createdAt: Date.now(),
        });
      },
    }));

const matchGoalQuery: IntentMatcher = (query, state) =>
  state.goals
    .filter((g) => score(query, g.name) >= 1)
    .map((g) => ({
      id: `q-goal-${g.id}`,
      icon: g.icon,
      label: `Show: ${g.name} status`,
      run: () => {
        const done = g.subgoals.filter((x) => x.done).length;
        state.setEphemeral({
          title: g.name,
          subtitle: `${Math.round(g.progress * 100)}% · ${done}/${g.subgoals.length} steps`,
          lines: g.subgoals.map((x) => `${x.done ? "■" : "□"}  ${x.name}`),
          createdAt: Date.now(),
        });
      },
    }));

const INTENT_MATCHERS: IntentMatcher[] = [
  matchAddTask,
  matchCloseTask(/^(?:done|complete|finish|did|check)\s+(.+)/i, "done"),
  matchCloseTask(/^skip\s+(.+)/i, "skip"),
  matchReadBook,
  matchWatchFilm,
  matchPlanWeek,
  matchFocusGoal,
  matchTodayQuery,
  matchStillOpenQuery,
  matchBacklogQuery,
  matchValueQuery,
  matchGoalQuery,
];

/**
 * Deterministic, local natural-language-ish command parser. Swap in an
 * AnthropicAgent (same Agent interface) when an API key is present.
 */
export class LocalIntentAgent implements Agent {
  id = "local";

  async suggest(query: string): Promise<AgentResult> {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) return { actions: [] };
    const state = useStore.getState();
    return { actions: INTENT_MATCHERS.flatMap((match) => match(trimmedQuery, state)) };
  }
}
