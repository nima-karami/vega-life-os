import { useEffect, useRef, useState } from "react";
import { runAgent } from "@/core/agent";
import { todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";

interface Line {
  id: number;
  kind: "in" | "out" | "sys";
  text: string;
}

let lineSeq = 0;
const nextLineId = () => ++lineSeq;

const bar = (v: number, n = 20) =>
  "█".repeat(Math.round(v * n)) + "░".repeat(n - Math.round(v * n));

export function TerminalVariant() {
  const store = useStore;
  const [lines, setLines] = useState<Line[]>([]);
  const [input, setInput] = useState("");
  const [history, setHistory] = useState<string[]>([]);
  const [hIdx, setHIdx] = useState(-1);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const print = (text: string, kind: Line["kind"] = "out") =>
    setLines((l) => [...l, { id: nextLineId(), kind, text }]);

  useEffect(() => {
    const s = store.getState();
    const done = s.tasks.filter((t) => t.date === todayISO() && t.status === "done").length;
    const total = s.tasks.filter((t) => t.date === todayISO()).length;
    setLines([
      { id: nextLineId(), kind: "sys", text: "VEGA LIFE.OS  ·  terminal interface  ·  v0.1" },
      {
        id: nextLineId(),
        kind: "sys",
        text: `operator: avery quinn   ${new Date().toDateString()}`,
      },
      {
        id: nextLineId(),
        kind: "sys",
        text: `today: ${done}/${total} resolved   ·   type 'help' for commands`,
      },
      { id: nextLineId(), kind: "sys", text: "" },
    ]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (lines.length === 0) return;
    endRef.current?.scrollIntoView();
  }, [lines]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

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
      case "clear":
        setLines([]);
        break;
      case "today":
      case "queue": {
        const q = s.tasks
          .filter((t) => t.date === todayISO())
          .sort((a, b) => (a.time ?? "99").localeCompare(b.time ?? "99"));
        if (!q.length) print("  (nothing scheduled)");
        for (const t of q) {
          print(
            `  [${t.status === "done" ? "x" : t.status === "skip" ? "~" : " "}] ${t.time ?? "--:--"}  ${t.title}`,
          );
        }
        break;
      }
      case "values":
        for (const v of s.values) {
          print(`  ${v.name.padEnd(12)} ${bar(v.energy)} ${Math.round(v.energy * 100)}%`);
        }
        break;
      case "goals":
        for (const g of s.goals) {
          print(`  ${g.name.padEnd(26)} ${bar(g.progress, 14)} ${Math.round(g.progress * 100)}%`);
        }
        break;
      case "habits":
        for (const h of s.habits) print(`  ${h.name.padEnd(22)} ${h.recurrence}`);
        break;
      case "backlog": {
        const b = s.tasks.filter((t) => t.date === null && t.status !== "done");
        for (const t of b) print(`  · ${t.title}`);
        if (!b.length) print("  (empty)");
        break;
      }
      case "theme":
        s.toggleTheme();
        print("  theme toggled (affects main app)");
        break;
      default: {
        void runAgent(cmd).then(({ actions }) => {
          if (actions.length) {
            actions[0].run();
            print(`  ✓ ${actions[0].label}`);
          } else print(`  unknown: '${cmd}'  (try 'help')`, "sys");
        });
      }
    }
  };

  return (
    // a <label> gives native click-to-focus for the input it wraps
    <label className="absolute inset-0 overflow-y-auto bg-[#07070a] p-5 font-mono text-[13px] leading-relaxed text-[#d8d2c2]">
      {lines.map((l) => (
        <div
          key={l.id}
          className={
            l.kind === "in"
              ? "text-[#efeada]"
              : l.kind === "sys"
                ? "text-[#8a877a]"
                : "text-[#b6b1a2]"
          }
        >
          {l.kind === "in" ? <span className="text-[#c9a04e]">vega&gt; </span> : null}
          <span className="whitespace-pre-wrap">{l.text}</span>
        </div>
      ))}
      <div className="flex items-center">
        <span className="text-[#c9a04e]">vega&gt;&nbsp;</span>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              run(input);
              setInput("");
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              const n = Math.min(hIdx + 1, history.length - 1);
              setHIdx(n);
              setInput(history[n] ?? "");
            } else if (e.key === "ArrowDown") {
              e.preventDefault();
              const n = Math.max(hIdx - 1, -1);
              setHIdx(n);
              setInput(history[n] ?? "");
            }
          }}
          className="flex-1 bg-transparent text-[#efeada] caret-[#c9a04e] outline-none"
          spellCheck={false}
        />
      </div>
      <div ref={endRef} />
    </label>
  );
}
