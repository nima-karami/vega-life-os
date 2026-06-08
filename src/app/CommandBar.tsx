import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";
import { agent } from "@/core/agent";
import { NAV } from "./nav";

/**
 * Minimal command palette. Task 15 swaps the freeform branch for the
 * LocalIntentAgent (and an AnthropicAgent when a key is present).
 */
export function CommandBar() {
  const open = useStore((s) => s.commandOpen);
  const close = useStore((s) => s.closeCommand);
  const addTask = useStore((s) => s.addTask);
  const reseed = useStore((s) => s.reseed);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const pushToast = useStore((s) => s.pushToast);
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const smart = query.trim() ? agent.suggest(query) : [];

  // reset the input each time the palette opens
  useEffect(() => {
    if (open) setQuery("");
  }, [open]);

  const go = (to: string) => {
    navigate(to);
    close();
  };

  const quickAdd = () => {
    const title = query.trim();
    if (!title) return;
    addTask({ title, date: null });
    pushToast(`Added "${title}" to backlog`);
    setQuery("");
    close();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.12 }}
          className="fixed inset-0 z-50 grid place-items-start justify-center bg-black/30 px-4 pt-[12vh]"
          onClick={close}
        >
          <motion.div
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -8, opacity: 0 }}
            transition={{ duration: 0.14 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-xl border border-ink bg-paper shadow-2xl"
          >
            <Command label="Command palette" className="flex flex-col">
              <div className="flex items-center gap-2.5 border-b border-[var(--color-line)] px-3.5 py-3">
                <Icon name="command" size={16} className="text-stone" />
                <Command.Input
                  autoFocus
                  value={query}
                  onValueChange={setQuery}
                  placeholder="Search, navigate, or type a task…"
                  className="mono w-full bg-transparent text-[13px] text-ink outline-none placeholder:text-mist"
                  onKeyDown={(e) => {
                    if (e.key === "Enter" && e.metaKey) quickAdd();
                  }}
                />
                <span className="label">ESC</span>
              </div>
              <Command.List className="max-h-[52vh] overflow-y-auto p-1.5">
                <Command.Empty className="px-3 py-6 text-center">
                  <button
                    onClick={quickAdd}
                    className="mono text-[12px] text-ink underline-offset-4 hover:underline"
                  >
                    + Add "{query}" to backlog
                  </button>
                </Command.Empty>

                {smart.length > 0 && (
                  <Command.Group
                    heading="Smart actions"
                    className="[&_[cmdk-group-heading]]:label [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5"
                  >
                    {smart.map((a) => (
                      <Item key={a.id} value={`${query} ${a.label}`} icon={a.icon} onSelect={() => { a.run(); close(); }}>
                        {a.label}
                      </Item>
                    ))}
                  </Command.Group>
                )}

                <Command.Group
                  heading="Navigate"
                  className="[&_[cmdk-group-heading]]:label [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5"
                >
                  {NAV.map((n) => (
                    <Item key={n.to} onSelect={() => go(n.to)} icon={n.icon} value={`go ${n.label} ${n.sub}`}>
                      {n.label}
                      <span className="ml-2 text-stone">— {n.sub}</span>
                    </Item>
                  ))}
                  <Item onSelect={() => go("/lab")} icon="flash" value="lab variants design">
                    Lab — design variants
                  </Item>
                  <Item onSelect={() => go("/settings")} icon="sliders" value="settings identity theme data backup export">
                    Settings — identity, theme, data
                  </Item>
                </Command.Group>

                <Command.Group
                  heading="Actions"
                  className="[&_[cmdk-group-heading]]:label [&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:py-1.5"
                >
                  <Item onSelect={quickAdd} icon="plus" value="add task new backlog">
                    Add "{query || "task"}" to backlog
                  </Item>
                  <Item onSelect={() => { toggleTheme(); close(); }} icon="moon" value="theme dark light toggle">
                    Toggle theme
                  </Item>
                  <Item
                    onSelect={() => { void reseed(); pushToast("Demo data reset"); close(); }}
                    icon="repeat"
                    value="reseed reset demo data"
                  >
                    Reset demo data
                  </Item>
                </Command.Group>
              </Command.List>
            </Command>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function Item({
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
      className="mono flex cursor-pointer items-center gap-2.5 px-2.5 py-2 text-[12px] text-ink data-[selected=true]:bg-ink data-[selected=true]:text-paper"
    >
      <Icon name={icon} size={14} />
      <span className="flex items-center">{children}</span>
    </Command.Item>
  );
}
