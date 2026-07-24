import { Modal, useOverlayState } from "@heroui/react";
import { Link } from "react-router";
import { useStore } from "@/core/store";
import { Icon, useCompactModal } from "@/core/ui";
import type { Habit } from "@/features/habits/model";
import { describeRecurrence, getHabitSchedule } from "@/features/habits/recurrence";
import { computeHabitTimeline, type TimelineKind } from "../selectors";

const KIND_STYLE: Record<TimelineKind, { style: React.CSSProperties; className: string }> = {
  done: { style: { background: "var(--color-accent)" }, className: "" },
  moved: { style: { background: "var(--color-accent)", opacity: 0.5 }, className: "" },
  miss: { style: { background: "var(--color-signal)" }, className: "" },
  skip: { style: {}, className: "border border-border" },
  pending: { style: {}, className: "border border-dashed border-line-strong" },
  off: { style: {}, className: "border border-line-soft opacity-50" },
};

const LEGEND: { kind: TimelineKind; label: string }[] = [
  { kind: "done", label: "Done" },
  { kind: "moved", label: "Moved" },
  { kind: "skip", label: "Skipped" },
  { kind: "miss", label: "Missed" },
  { kind: "pending", label: "Pending" },
];

function Cell({
  style,
  className,
  title,
}: {
  style: React.CSSProperties;
  className: string;
  title: string;
}) {
  return (
    <span
      title={title}
      className={className}
      style={{ width: 13, height: 13, borderRadius: 2, ...style }}
    />
  );
}

const KIND_WORD: Record<TimelineKind, string> = {
  done: "done",
  moved: "done (moved)",
  miss: "missed",
  skip: "skipped",
  pending: "pending",
  off: "not scheduled",
};

export function HabitReportModal({
  habit,
  windowDays,
  isOpen,
  onClose,
}: {
  habit: Habit;
  windowDays: number;
  isOpen: boolean;
  onClose: () => void;
}) {
  const tasks = useStore((s) => s.tasks);
  const responsive = useCompactModal();
  const timeline = computeHabitTimeline(tasks, habit, windowDays);
  const state = useOverlayState({
    isOpen,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
  });

  return (
    <Modal state={state}>
      <Modal.Backdrop variant="blur">
        <Modal.Container {...responsive}>
          <Modal.Dialog aria-label={`${habit.name} report`}>
            <Modal.Header>
              <div className="flex flex-col gap-1">
                <Modal.Heading className="text-lg font-semibold">{habit.name}</Modal.Heading>
                <span className="text-xs font-normal text-muted">
                  {describeRecurrence(getHabitSchedule(habit))}
                </span>
              </div>
            </Modal.Header>

            <Modal.Body className="gap-5">
              <div className="grid grid-cols-3 gap-3">
                <Stat value={`${timeline.streak}`} label="day streak" />
                <Stat
                  value={`${Math.round(timeline.rate * 100)}%`}
                  label={`follow-through · ${windowDays}d`}
                />
                <Stat
                  value={`${timeline.done}/${timeline.done + timeline.missed}`}
                  label={`done / due · ${windowDays}d`}
                />
              </div>

              <div>
                <p className="mb-2.5 text-xs text-muted">Last {timeline.days.length} days</p>
                <div className="flex flex-wrap gap-[3px]">
                  {timeline.days.map((day) => {
                    const kind = KIND_STYLE[day.kind];
                    return (
                      <Cell
                        key={day.iso}
                        style={kind.style}
                        className={kind.className}
                        title={`${day.label} · ${KIND_WORD[day.kind]}`}
                      />
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1.5">
                  {LEGEND.map(({ kind, label }) => (
                    <span key={kind} className="flex items-center gap-1.5 text-[11px] text-muted">
                      <span
                        className={KIND_STYLE[kind].className}
                        style={{
                          width: 11,
                          height: 11,
                          borderRadius: 2,
                          ...KIND_STYLE[kind].style,
                        }}
                      />
                      {label}
                    </span>
                  ))}
                </div>
              </div>
            </Modal.Body>

            <Modal.Footer className="justify-between">
              <Link
                to={`/habits?habit=${habit.id}`}
                onClick={onClose}
                className="inline-flex items-center gap-1.5 text-sm text-accent outline-none hover:underline focus-visible:ring-2 focus-visible:ring-accent"
              >
                <Icon name="link" size={14} />
                View habit
              </Link>
              <button
                type="button"
                onClick={onClose}
                className="rounded-md px-3 py-1.5 text-sm text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
              >
                Close
              </button>
            </Modal.Footer>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="rounded-lg bg-surface-secondary p-3 text-center">
      <p className="text-xl font-semibold tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 text-[11px] text-muted">{label}</p>
    </div>
  );
}
