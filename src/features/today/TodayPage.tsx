import { OmniTrigger } from "@/app/OmniTrigger";
import { useStore } from "@/core/store";

/**
 * Today view — slice 0 shell only.
 * The always-visible omni trigger lives at the top.
 * Full task-card composition arrives in slice 1 (Today view).
 */
export function TodayPage() {
  const tasks = useStore((s) => s.tasks);
  const todayCount = tasks.filter((t) => t.date !== null && t.status !== "done").length;

  return (
    <div className="mx-auto max-w-2xl px-4 py-6">
      <OmniTrigger />

      <div className="mt-8">
        <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">
          Today
        </h1>
        <p className="mt-1 font-sans text-sm text-[var(--color-muted)]">
          {todayCount > 0
            ? `${todayCount} task${todayCount !== 1 ? "s" : ""} scheduled`
            : "Nothing scheduled yet — add something to get started."}
        </p>
      </div>

      <div className="mt-6">
        <p className="font-sans text-sm text-[var(--color-muted)]">
          The full Today view arrives in slice 1. Use ⌘K or the bar above to navigate.
        </p>
      </div>
    </div>
  );
}
