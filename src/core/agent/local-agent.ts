import { useStore } from "@/core/store";
import { todayISO } from "@/core/lib/date";
import { subDays, format } from "date-fns";
import type { Task } from "@/features/tasks/model";
import type { Agent, AgentAction } from "./types";
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
  tasks.filter((t) => t.status === "todo" || t.status === "doing");

/**
 * Deterministic, local natural-language-ish command parser. Swap in an
 * AnthropicAgent (same Agent interface) when an API key is present.
 */
export class LocalIntentAgent implements Agent {
  id = "local";

  suggest(query: string): AgentAction[] {
    const q = query.trim();
    if (!q) return [];
    const s = useStore.getState();
    const out: AgentAction[] = [];
    const lower = q.toLowerCase();

    // ---- mutations with explicit verbs ----
    const add = q.match(/^(?:add|new|todo|task)\s+(.+)/i);
    if (add) {
      const { date, time, rest } = parseWhen(add[1]);
      out.push({
        id: "add", icon: "plus",
        label: `Add task: "${rest}"${date ? ` · ${date === todayISO() ? "today" : date.slice(5)}` : " · backlog"}${time ? ` ${time}` : ""}`,
        run: () => {
          s.addTask({ title: rest, date: date ?? null, time: time ?? null, status: "todo" });
          s.pushToast(`Added "${rest}"`);
        },
      });
    }

    const done = q.match(/^(?:done|complete|finish|did|check)\s+(.+)/i);
    if (done) {
      openTasks(s.tasks)
        .map((t) => ({ t, sc: score(done[1], t.title) }))
        .filter((x) => x.sc > 0.4)
        .sort((a, b) => b.sc - a.sc)
        .slice(0, 3)
        .forEach(({ t }) =>
          out.push({
            id: `done-${t.id}`, icon: "check", label: `Complete: ${t.title}`,
            run: () => { s.setStatus(t.id, "done"); s.pushToast(`Completed "${t.title}"`); },
          }),
        );
    }

    const skip = q.match(/^skip\s+(.+)/i);
    if (skip) {
      openTasks(s.tasks)
        .map((t) => ({ t, sc: score(skip[1], t.title) }))
        .filter((x) => x.sc > 0.4)
        .sort((a, b) => b.sc - a.sc)
        .slice(0, 3)
        .forEach(({ t }) =>
          out.push({
            id: `skip-${t.id}`, icon: "skip", label: `Skip: ${t.title}`,
            run: () => { s.setStatus(t.id, "skip"); s.pushToast(`Skipped "${t.title}"`); },
          }),
        );
    }

    // ---- library shortcuts ----
    const read = q.match(/^(?:read|reading|book)\s+(.+)/i);
    if (read) out.push({
      id: "read", icon: "book", label: `Add book: "${read[1]}"`,
      run: () => { s.addBook({ title: read[1], status: "reading", startedAt: todayISO() }); s.pushToast(`Reading "${read[1]}"`); },
    });
    const watch = q.match(/^(?:watch|watched|film|movie)\s+(.+)/i);
    if (watch) out.push({
      id: "watch", icon: "film", label: `Add film: "${watch[1]}"`,
      run: () => { s.addMovie({ title: watch[1], status: "queued" }); s.pushToast(`Added "${watch[1]}" to watchlist`); },
    });
    const learn = q.match(/^(?:learn|word|vocab)\s+(.+)/i);
    if (learn) out.push({
      id: "learn", icon: "languages", label: `Add word: "${learn[1]}"`,
      run: () => { s.addVocab({ term: learn[1] }); s.pushToast(`Added "${learn[1]}"`); },
    });

    // ---- planning ----
    if (/\b(plan|generate|fill).*(week)\b/i.test(lower) || lower === "plan week") {
      out.push({
        id: "plan", icon: "flash", label: "Plan this week (fill habit blocks)",
        run: () => { const n = s.planWeek(); s.pushToast(n ? `Planned ${n} blocks` : "Week already full"); },
      });
    }

    // ---- focus a goal ----
    const focus = q.match(/^focus\s+(.+)/i);
    if (focus) {
      s.goals
        .map((g) => ({ g, sc: score(focus[1], g.name) }))
        .filter((x) => x.sc > 0.3)
        .sort((a, b) => b.sc - a.sc)
        .slice(0, 2)
        .forEach(({ g }) =>
          out.push({ id: `focus-${g.id}`, icon: "target", label: `Focus: ${g.name}`, run: () => { s.setFocusGoal(g.id); s.pushToast(`Focused on ${g.name}`); } }),
        );
    }

    // ---- queries -> ephemeral views ----
    if (/(due )?today|what.?s (on|today)/i.test(lower)) {
      out.push({
        id: "q-today", icon: "calendar", label: "Show: today's queue",
        run: () => {
          const ids = s.tasks.filter((t) => t.date === todayISO()).sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99")).map((t) => t.id);
          s.setEphemeral({ title: "Today", subtitle: `${ids.length} scheduled`, taskIds: ids, createdAt: Date.now() });
        },
      });
    }
    if (/overdue|behind|late|missed/i.test(lower)) {
      out.push({
        id: "q-overdue", icon: "alert", label: "Show: overdue tasks",
        run: () => {
          const recent = format(subDays(new Date(), 14), "yyyy-MM-dd");
          const overdue = s.tasks
            .filter((t) => t.date && t.date >= recent && t.date < todayISO() && (t.status === "todo" || t.status === "doing"))
            .sort((a, b) => (a.date! < b.date! ? 1 : -1));
          s.setEphemeral({ title: "Overdue", subtitle: `${overdue.length} unresolved · last 14 days`, taskIds: overdue.map((t) => t.id), createdAt: Date.now() });
        },
      });
    }
    if (/backlog/i.test(lower)) {
      out.push({
        id: "q-backlog", icon: "board", label: "Show: backlog",
        run: () => {
          const ids = s.tasks.filter((t) => t.date === null && t.status !== "done").map((t) => t.id);
          s.setEphemeral({ title: "Backlog", subtitle: `${ids.length} undated`, taskIds: ids, createdAt: Date.now() });
        },
      });
    }
    // a value name -> that value's open work this week
    s.values
      .filter((v) => score(q, v.name) >= 1)
      .forEach((v) =>
        out.push({
          id: `q-val-${v.id}`, icon: v.icon, label: `Show: ${v.name} work`,
          run: () => {
            const ids = s.tasks.filter((t) => t.valueId === v.id && (t.status === "todo" || t.status === "doing")).map((t) => t.id);
            s.setEphemeral({ title: v.name, subtitle: v.desc, taskIds: ids.slice(0, 30), createdAt: Date.now() });
          },
        }),
      );
    // a goal name -> goal summary
    s.goals
      .filter((g) => score(q, g.name) >= 1)
      .forEach((g) =>
        out.push({
          id: `q-goal-${g.id}`, icon: g.icon, label: `Show: ${g.name} status`,
          run: () => {
            const done = g.subgoals.filter((x) => x.done).length;
            s.setEphemeral({
              title: g.name,
              subtitle: `${Math.round(g.progress * 100)}% · ${done}/${g.subgoals.length} steps`,
              lines: g.subgoals.map((x) => `${x.done ? "■" : "□"}  ${x.name}`),
              createdAt: Date.now(),
            });
          },
        }),
      );

    return out;
  }
}

export const agent: Agent = new LocalIntentAgent();
