import { Command } from "cmdk";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { type AgentAction, runAgent } from "@/core/agent";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";
import {
  ACTION_COMMANDS,
  type ActionCommand,
  type CommandApi,
  getRegistryVersion,
  getViewCommands,
  NAV_COMMANDS,
  subscribeRegistry,
} from "./commands";

/**
 * Vapor command bar — the sole navigation surface.
 * Shows: agent smart-actions, Navigate group (5 routes), Actions group (core + view-registered).
 */
export function CommandBar() {
  const open = useStore((s) => s.commandOpen);
  const close = useStore((s) => s.closeCommand);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [smart, setSmart] = useState<AgentAction[]>([]);
  const [reply, setReply] = useState<string>("");
  const [thinking, setThinking] = useState(false);
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // Track view-command registry changes
  const [_regVersion, setRegVersion] = useState(getRegistryVersion);
  useEffect(() => {
    return subscribeRegistry(() => setRegVersion(getRegistryVersion()));
  }, []);

  // Snapshot view commands on each re-render triggered by version bump
  const viewCommands = getViewCommands();
  const allActions = [...ACTION_COMMANDS, ...viewCommands];

  // Agent debounce
  useEffect(() => {
    const q = query.trim();
    if (!q) {
      setSmart([]);
      setReply("");
      setThinking(false);
      return;
    }
    setThinking(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      const r = await runAgent(q);
      if (cancelled) return;
      setSmart(r.actions);
      setReply(r.message ?? "");
      setThinking(false);
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [query]);

  // Save/restore focus; reset input on open
  useEffect(() => {
    if (open) {
      previousFocusRef.current = document.activeElement as HTMLElement;
      setQuery("");
      setSmart([]);
      setReply("");
      setThinking(false);
    } else {
      // Return focus to omni trigger or previous element after close
      const trigger = document.querySelector<HTMLElement>('[data-testid="omni-trigger"]');
      const target = trigger ?? previousFocusRef.current;
      target?.focus();
    }
  }, [open]);

  const buildApi = (q: string): CommandApi => ({
    navigate,
    close,
    store: useStore,
    query: q,
  });

  const go = (to: string) => {
    navigate(to);
    close();
  };

  const quickAdd = () => {
    const title = query.trim();
    if (!title) return;
    useStore.getState().addTask({ title, date: null });
    useStore.getState().pushToast(`Added "${title}" to backlog`);
    setQuery("");
    close();
  };

  const runAction = (cmd: ActionCommand) => {
    cmd.run(buildApi(query));
  };

  return (
    <>
      {/* Live region for screen reader announcements */}
      <div aria-live="polite" aria-atomic="true" className="sr-only" id="command-bar-status">
        {open ? (thinking ? "Thinking…" : "Command bar open") : ""}
      </div>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            className="fixed inset-0 z-50 grid place-items-start justify-center bg-black/30 px-4 pt-[12vh] backdrop-blur-sm"
            onClick={close}
            role="dialog"
            aria-modal="true"
            aria-label="Command bar"
          >
            <motion.div
              initial={{ y: -8, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -8, opacity: 0 }}
              transition={{ duration: 0.14 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-xl overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] shadow-[var(--shadow-soft)]"
            >
              <Command label="Command palette" className="flex flex-col">
                {/* Input */}
                <div className="flex items-center gap-2.5 border-b border-[var(--color-line)] px-4 py-3">
                  <Icon name="search" size={16} className="shrink-0 text-[var(--color-muted)]" />
                  <Command.Input
                    autoFocus
                    value={query}
                    onValueChange={setQuery}
                    placeholder="Search, navigate, or ask…"
                    className="w-full bg-transparent font-sans text-sm text-[var(--color-ink)] outline-none placeholder:text-[var(--color-muted)]"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) quickAdd();
                      if (e.key === "Escape") close();
                    }}
                  />
                  <kbd className="rounded bg-[var(--color-canvas)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-muted)]">
                    ESC
                  </kbd>
                </div>

                {/* Results */}
                <Command.List className="max-h-[52vh] overflow-y-auto p-1.5">
                  {thinking && (
                    <div className="flex items-center gap-2 px-3 py-2 font-sans text-[12px] text-[var(--color-muted)]">
                      <Icon
                        name="spark"
                        size={13}
                        className="animate-pulse text-[var(--color-accent)]"
                      />
                      Thinking…
                    </div>
                  )}
                  {reply && (
                    <p className="mb-1 rounded-[var(--radius-sm)] bg-[var(--color-canvas)] px-3 py-2.5 font-sans text-[13px] leading-relaxed text-[var(--color-ink)]">
                      {reply}
                    </p>
                  )}

                  <Command.Empty className="px-3 py-6 text-center">
                    <button
                      type="button"
                      onClick={quickAdd}
                      className="font-sans text-[13px] font-medium text-[var(--color-accent)] underline-offset-4 hover:underline"
                    >
                      + Add &ldquo;{query}&rdquo; to backlog
                    </button>
                  </Command.Empty>

                  {/* Smart actions (agent) */}
                  {smart.length > 0 && (
                    <Command.Group
                      heading="Smart actions"
                      className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-sans [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[var(--color-muted)]"
                    >
                      {smart.map((a) => (
                        <CmdItem
                          key={a.id}
                          value={`${query} ${a.label}`}
                          icon={a.icon}
                          onSelect={() => {
                            a.run();
                            close();
                          }}
                        >
                          {a.label}
                        </CmdItem>
                      ))}
                    </Command.Group>
                  )}

                  {/* Navigate group */}
                  <Command.Group
                    heading="Navigate"
                    className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-sans [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[var(--color-muted)]"
                  >
                    {NAV_COMMANDS.map((n) => (
                      <CmdItem
                        key={n.id}
                        onSelect={() => go(n.to)}
                        icon={n.icon}
                        value={`go ${n.label} ${n.sublabel ?? ""} ${n.keywords ?? ""}`}
                      >
                        {n.label}
                        {n.sublabel && (
                          <span className="ml-2 text-[var(--color-muted)]">— {n.sublabel}</span>
                        )}
                      </CmdItem>
                    ))}
                  </Command.Group>

                  {/* Actions group */}
                  <Command.Group
                    heading="Actions"
                    className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:font-sans [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-[var(--color-muted)]"
                  >
                    {allActions.map((cmd) => (
                      <CmdItem
                        key={cmd.id}
                        onSelect={() => runAction(cmd)}
                        icon={cmd.icon}
                        value={`${cmd.label} ${cmd.keywords ?? ""}`}
                      >
                        {cmd.id === "action-add-task"
                          ? `Add "${query || "task"}" to backlog`
                          : cmd.label}
                      </CmdItem>
                    ))}
                  </Command.Group>
                </Command.List>
              </Command>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}

function CmdItem({
  children,
  onSelect,
  icon,
  value,
}: {
  children: React.ReactNode;
  onSelect: () => void;
  icon: Parameters<typeof Icon>[0]["name"];
  value: string;
}) {
  return (
    <Command.Item
      value={value}
      onSelect={onSelect}
      className="
        flex cursor-pointer items-center gap-2.5
        rounded-[var(--radius-sm)]
        px-2.5 py-2
        font-sans text-[13px] text-[var(--color-ink)]
        transition-colors duration-100
        data-[selected=true]:bg-[var(--color-canvas)]
        data-[selected=true]:text-[var(--color-ink)]
        data-[selected=true]:[&_svg]:text-[var(--color-accent)]
      "
    >
      <Icon name={icon} size={14} className="shrink-0 text-[var(--color-muted)]" />
      <span className="flex items-center">{children}</span>
    </Command.Item>
  );
}
