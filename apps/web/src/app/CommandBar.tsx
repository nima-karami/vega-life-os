import { Command } from "cmdk";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router";
import { type AgentAction, runAgent } from "@/core/agent";
import { useQuietMode, useStore } from "@/core/store";
import { Icon } from "@/core/ui";
import {
  ACTION_COMMANDS,
  type ActionCommand,
  buildQuietModeCommand,
  type CommandApi,
  getRegistryVersion,
  getViewCommands,
  NAV_COMMANDS,
  subscribeRegistry,
} from "./commands";
import { filterQuietRoutes } from "./quiet-routes";

/**
 * Vapor command bar — the sole navigation surface.
 * Shows: agent smart-actions, Navigate group (5 routes), Actions group (core + view-registered).
 */
export function CommandBar() {
  const open = useStore((s) => s.commandOpen);
  const close = useStore((s) => s.closeCommand);
  const isQuiet = useQuietMode();
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
  const allActions = [...ACTION_COMMANDS, buildQuietModeCommand(isQuiet), ...viewCommands];

  // Agent debounce
  useEffect(() => {
    const trimmedQuery = query.trim();
    if (!trimmedQuery) {
      setSmart([]);
      setReply("");
      setThinking(false);
      return;
    }
    setThinking(true);
    let cancelled = false;
    const t = setTimeout(async () => {
      const r = await runAgent(trimmedQuery);
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

  const addAsWord = () => {
    navigate("/cards");
    setQuery("");
    close();
  };

  const addAsExpense = () => {
    const entry = query.trim();
    if (!entry) return;
    useStore.getState().setPendingFinanceEntry(entry);
    navigate("/finance/transactions");
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
            className="safe-inset-x fixed inset-0 z-50 grid place-items-start justify-center bg-black/40 px-4 pt-[12dvh] backdrop-blur-sm"
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
              className="w-full max-w-xl overflow-hidden rounded-[16px] border border-border bg-surface shadow-md"
            >
              <Command label="Command palette" className="flex flex-col">
                {/* Input */}
                <div className="flex items-center gap-2.5 border-b border-border px-4 py-3">
                  <Icon name="search" size={16} className="shrink-0 text-muted" />
                  <Command.Input
                    autoFocus
                    value={query}
                    onValueChange={setQuery}
                    placeholder="Search, navigate, or ask…"
                    className="w-full bg-transparent text-[16px] text-foreground outline-none placeholder:text-muted sm:text-sm"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) quickAdd();
                      if (e.key === "Escape") close();
                    }}
                  />
                  <kbd className="rounded bg-surface-secondary px-1.5 py-0.5 font-mono text-xs text-muted">
                    ESC
                  </kbd>
                </div>

                {/* Results */}
                <Command.List className="max-h-[52dvh] overflow-y-auto p-1.5">
                  {thinking && (
                    <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted">
                      <Icon name="spark" size={13} className="animate-pulse text-accent" />
                      Thinking…
                    </div>
                  )}
                  {reply && (
                    <p className="mb-1 rounded-[8px] bg-surface-secondary px-3 py-2.5 text-sm leading-relaxed text-foreground">
                      {reply}
                    </p>
                  )}

                  <Command.Empty className="flex flex-col items-center gap-2 px-3 py-6 text-center">
                    <button
                      type="button"
                      onClick={quickAdd}
                      className="text-sm font-medium text-accent underline-offset-4 hover:underline"
                    >
                      + Add &ldquo;{query}&rdquo; to backlog
                    </button>
                    <button
                      type="button"
                      onClick={addAsWord}
                      className="text-sm font-medium text-accent underline-offset-4 hover:underline"
                    >
                      + Add &ldquo;{query}&rdquo; as a word
                    </button>
                    <button
                      type="button"
                      onClick={addAsExpense}
                      className="text-sm font-medium text-accent underline-offset-4 hover:underline"
                    >
                      + Add &ldquo;{query}&rdquo; as an expense
                    </button>
                  </Command.Empty>

                  {/* Smart actions (agent) */}
                  {smart.length > 0 && (
                    <Command.Group
                      heading="Smart actions"
                      className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted"
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
                    className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted"
                  >
                    {filterQuietRoutes(NAV_COMMANDS, isQuiet).map((n) => (
                      <CmdItem
                        key={n.id}
                        onSelect={() => go(n.to)}
                        icon={n.icon}
                        value={`go ${n.label} ${n.sublabel ?? ""} ${n.keywords ?? ""}`}
                      >
                        {n.label}
                        {n.sublabel && <span className="ml-2 text-muted">{n.sublabel}</span>}
                      </CmdItem>
                    ))}
                  </Command.Group>

                  {/* Actions group */}
                  <Command.Group
                    heading="Actions"
                    className="[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-xs [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-muted"
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
        rounded-[8px]
        px-2.5 py-2
        text-sm text-foreground
        transition-colors duration-100
        data-[selected=true]:bg-default/40
        data-[selected=true]:text-foreground
        data-[selected=true]:[&_svg]:text-accent
      "
    >
      <Icon name={icon} size={14} className="shrink-0 text-muted" />
      <span className="flex items-center">{children}</span>
    </Command.Item>
  );
}
