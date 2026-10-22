import { format, subDays } from "date-fns";
import { todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";
import type { Task } from "@/features/tasks/model";
import type { Agent, AgentAction, AgentResult } from "./types";
import { parseWhen } from "./when";

const score = (q: string, text: string) => {
  const a = q.toLowerCase();
  const b = text.toLowerCase();
  if (b.includes(a)) return 2;
  const toks = a.split(/\s+/).filter(Boolean);
  const hit = toks.filter((t) => b.includes(t)).length;
  return toks.length ? hit / toks.length : 0;
};

const openTasks = (tasks: Task[]) =>
  tasks.filter((t) => t.status !== "done" && t.status !== "skip");

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
    const out: AgentAction[] = [];
    const lower = trimmedQuery.toLowerCase();

    // ---- mutations with explicit verbs ----
    const add = trimmedQuery.match(/^(?:add|new|todo|task)\s+(.+)/i);
    if (add) {
      const { date, time, rest } = parseWhen(add[1]);
      out.push({
        id: "add",
        icon: "plus",
        label: `Add task: "${rest}"${date ? ` · ${date === todayISO() ? "today" : date.slice(5)}` : " · backlog"}${time ? ` ${time}` : ""}`,
        run: () => {
          state.addTask({ title: rest, date: date ?? null, time: time ?? null });
          state.pushToast(`Added "${rest}"`);
        },
      });
    }

    const done = trimmedQuery.match(/^(?:done|complete|finish|did|check)\s+(.+)/i);
    if (done) {
      const matches = openTasks(state.tasks)
        .map((t) => ({ t, sc: score(done[1], t.title) }))
        .filter((x) => x.sc > 0.4)
        .sort((a, b) => b.sc - a.sc)
        .slice(0, 3);
      for (const { t } of matches) {
        out.push({
          id: `done-${t.id}`,
          icon: "check",
          label: `Complete: ${t.title}`,
          run: () => {
            state.setStatus(t.id, "done");
            state.pushToast(`Completed "${t.title}"`);
          },
        });
      }
    }

    const skip = trimmedQuery.match(/^skip\s+(.+)/i);
    if (skip) {
      const matches = openTasks(state.tasks)
        .map((t) => ({ t, sc: score(skip[1], t.title) }))
        .filter((x) => x.sc > 0.4)
        .sort((a, b) => b.sc - a.sc)
        .slice(0, 3);
      for (const { t } of matches) {
        out.push({
          id: `skip-${t.id}`,
          icon: "skip",
          label: `Skip: ${t.title}`,
          run: () => {
            state.setStatus(t.id, "skip");
            state.pushToast(`Skipped "${t.title}"`);
          },
        });
      }
    }

    // ---- library shortcuts ----
    const read = trimmedQuery.match(/^(?:read|reading|book)\s+(.+)/i);
    if (read)
      out.push({
        id: "read",
        icon: "book",
        label: `Add book: "${read[1]}"`,
        run: () => {
          state.addBook({ title: read[1], status: "reading", startedAt: todayISO() });
          state.pushToast(`Reading "${read[1]}"`);
        },
      });
    const watch = trimmedQuery.match(/^(?:watch|watched|film|movie)\s+(.+)/i);
    if (watch)
      out.push({
        id: "watch",
        icon: "film",
        label: `Add film: "${watch[1]}"`,
        run: () => {
          state.addMovie({ title: watch[1], status: "queued" });
          state.pushToast(`Added "${watch[1]}" to watchlist`);
        },
      });
    // ---- planning ----
    if (/\b(plan|generate|fill).*(week)\b/i.test(lower) || lower === "plan week") {
      out.push({
        id: "plan",
        icon: "flash",
        label: "Plan this week (fill habit blocks)",
        run: () => {
          const n = state.planWeek();
          state.pushToast(n ? `Planned ${n} blocks` : "Week already full");
        },
      });
    }

    // ---- focus a goal ----
    const focus = trimmedQuery.match(/^focus\s+(.+)/i);
    if (focus) {
      const matches = state.goals
        .map((g) => ({ g, sc: score(focus[1], g.name) }))
        .filter((x) => x.sc > 0.3)
        .sort((a, b) => b.sc - a.sc)
        .slice(0, 2);
      for (const { g } of matches) {
        out.push({
          id: `focus-${g.id}`,
          icon: "target",
          label: `Focus: ${g.name}`,
          run: () => {
            state.setFocusGoal(g.id);
            state.pushToast(`Focused on ${g.name}`);
          },
        });
      }
    }

    // ---- queries -> ephemeral views ----
    if (/(due )?today|what.?s (on|today)/i.test(lower)) {
      out.push({
        id: "q-today",
        icon: "calendar",
        label: "Show: today's queue",
        run: () => {
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
        },
      });
    }
    if (/overdue|behind|late|missed/i.test(lower)) {
      out.push({
        id: "q-still-open",
        icon: "alert",
        label: "Show: still-open tasks",
        run: () => {
          const recent = format(subDays(new Date(), 14), "yyyy-MM-dd");
          const overdue = state.tasks
            .filter(
              (t) =>
                t.date &&
                t.date >= recent &&
                t.date < todayISO() &&
                t.status !== "done" &&
                t.status !== "skip",
            )
            .sort((a, b) => ((a.date ?? "") < (b.date ?? "") ? 1 : -1));
          state.setEphemeral({
            title: "Still open",
            subtitle: `${overdue.length} still open · last 14 days`,
            taskIds: overdue.map((t) => t.id),
            createdAt: Date.now(),
          });
        },
      });
    }
    if (/backlog/i.test(lower)) {
      out.push({
        id: "q-backlog",
        icon: "board",
        label: "Show: backlog",
        run: () => {
          const ids = state.tasks
            .filter((t) => t.date === null && t.status !== "done")
            .map((t) => t.id);
          state.setEphemeral({
            title: "Backlog",
            subtitle: `${ids.length} undated`,
            taskIds: ids,
            createdAt: Date.now(),
          });
        },
      });
    }
    // a value name -> that value's open work this week
    for (const v of state.values.filter((vv) => score(trimmedQuery, vv.name) >= 1)) {
      out.push({
        id: `q-val-${v.id}`,
        icon: v.icon,
        label: `Show: ${v.name} work`,
        run: () => {
          const ids = state.tasks
            .filter((t) => t.valueId === v.id && t.status !== "done" && t.status !== "skip")
            .map((t) => t.id);
          state.setEphemeral({
            title: v.name,
            subtitle: v.desc,
            taskIds: ids.slice(0, 30),
            createdAt: Date.now(),
          });
        },
      });
    }
    // a goal name -> goal summary
    for (const g of state.goals.filter((gg) => score(trimmedQuery, gg.name) >= 1)) {
      out.push({
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
      });
    }

    return { actions: out };
  }
}
