import { useEffect, useRef, useState } from "react";
import { useStore } from "@/core/store";
import { agent } from "@/core/agent";
import { todayISO } from "@/core/lib/date";

interface Line { kind: "in" | "out" | "sys"; text: string }

const bar = (v: number, n = 20) => "█".repeat(Math.round(v * n)) + "░".repeat(n - Math.round(v * n));

export function TerminalVariant() {
  const store = useStore;
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const print = (text: string, kind: Line["kind"] = "out") =>
    setLines((l) => [...l, { kind, text }]);

  useEffect(() => {
    const s = store.getState();
    const done = s.tasks.filter((t) => t.date === todayISO() && t.status === "done").length;
    const total = s.tasks.filter((t) => t.date === todayISO()).length;
    setLines([
      { kind: "sys", text: "VEGA LIFE.OS  ·  terminal interface  ·  v0.1" },
      { kind: "sys", text: `operator: avery quinn   ${new Date().toDateString()}` },
      { kind: "sys", text: `today: ${done}/${total} resolved   ·   type 'help' for commands` },
      { kind: "sys", text: "" },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { endRef.current?.scrollIntoView(); }, [lines]);

  const run = (raw: string) => {
    const cmd = raw.trim();
    if (!cmd) return;
    print(cmd, "in");
    setHistory((h) => [cmd, ...h]);
    setHIdx(-1);
    const s = store.getState();
    const verb = cmd.toLowerCase().split(/\s+/)[0];

    switch (verb) {
      case "help":
        print("commands:");
        print("  today | queue        list today's tasks");
        print("  values | goals | habits | backlog");
        print("  done <task> | skip <task> | add <task>");
        print("  plan week | theme | clear");
        print("  …or just type naturally (powered by the agent)");
        break;
      case "clear": setLines([]); break;
      case "today":
      case "queue": {
        const q = s.tasks.filter((t) => t.date === todayISO()).sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
        if (!q.length) print("  (nothing scheduled)");
        q.forEach((t) => print(`  [${t.status === "done" ? "x" : t.status === "skip" ? "~" : " "}] ${t.time ?? "--:--"}  ${t.title}`));
        break;
      }
      case "values":
        s.values.forEach((v) => print(`  ${v.name.padEnd(12)} ${bar(v.energy)} ${Math.round(v.energy * 100)}%`));
        break;
      case "goals":
        s.goals.forEach((g) => print(`  ${g.name.padEnd(26)} ${bar(g.progress, 14)} ${Math.round(g.progress * 100)}%`));
        break;
      case "habits":
        s.habits.forEach((h) => print(`  ${h.name.padEnd(22)} ${h.recurrence}`));
        break;
      case "backlog": {
        const b = s.tasks.filter((t) => t.date === null && t.status !== "done");
        b.forEach((t) => print(`  · ${t.title}`));
        if (!b.length) print("  (empty)");
        break;
      }
      case "theme": s.toggleTheme(); print("  theme toggled (affects main app)"); break;
      default: {
        const actions = agent.suggest(cmd);
        if (actions.length) { actions[0].run(); print(`  ✓ ${actions[0].label}`); }
        else print(`  unknown: '${cmd}'  (try 'help')`, "sys");
      }
    }
  };

  return (
    <div className="absolute inset-0 overflow-y-auto bg-[#07070a] p-5 font-mono text-[13px] leading-relaxed text-[#d8d2c2]"
      onClick={() => inputRef.current?.focus()}>
      {lines.map((l, i) => (
        <div key={i} className={l.kind === "in" ? "text-[#efeada]" : l.kind === "sys" ? "text-[#8a877a]" : "text-[#b6b1a2]"}>
          {l.kind === "in" ? <span className="text-[#c9a04e]">vega&gt; </span> : null}
          <span className="whitespace-pre-wrap">{l.text}</span>
        </div>
      ))}
      <div className="flex items-center">
        <span className="text-[#c9a04e]">vega&gt;&nbsp;</span>
        <input
          ref={inputRef}
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { run(input); setInput(""); }
            else if (e.key === "ArrowUp") { e.preventDefault(); const n = Math.min(hIdx + 1, history.length - 1); setHIdx(n); setInput(history[n] ?? ""); }
            else if (e.key === "ArrowDown") { e.preventDefault(); const n = Math.max(hIdx - 1, -1); setHIdx(n); setInput(history[n] ?? ""); }
          }}
          className="flex-1 bg-transparent text-[#efeada] caret-[#c9a04e] outline-none"
          spellCheck={false}
        />
      </div>
      <div ref={endRef} />
    </div>
  );
}
