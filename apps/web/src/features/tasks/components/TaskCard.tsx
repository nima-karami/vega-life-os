import { Card } from "@heroui/react";
import { useLayoutEffect, useRef } from "react";
import { useStore } from "@/core/store";
import { Icon, Lineage, Menu, ROW_META_CLASS } from "@/core/ui";
import { BackToItLine } from "@/features/habits/BackToItLine";
import { useTaskLineage } from "@/features/tasks/lineage";
import { getValueColor } from "@/features/values/color";
import { buildVoteMessage } from "@/features/values/vote-message";
import type { Task } from "../model";
import { buildCardStateAttributes, buildTaskMenuItems, type TaskCardMotion } from "../task-card";
import { DoneCheck } from "./DoneCheck";
import { VoteTakeover } from "./VoteTakeover";
import "./task-card-motion.css";
import "./task-card-keyframes.css";
import "./task-card-reduced-motion.css";

interface TaskCardProps {
  task: Task;
  /** the done moment's state on Today; absent everywhere else, so the card renders at rest */
  motion?: TaskCardMotion;
  onOpen: (t: Task) => void;
  onToggleDone: (t: Task) => void;
  onSkip: (t: Task) => void;
  onUnskip: (t: Task) => void;
  onDelete: (t: Task) => void;
}

/**
 * TaskCard is the Today-view card: a value-coloured stripe, the done check, the title,
 * the lineage row and the optional time. A valued complete floods the card with the
 * value's colour and shows the vote; `task-card-motion.css` owns every beat.
 */
export function TaskCard({
  task,
  motion,
  onOpen,
  onToggleDone,
  onSkip,
  onUnskip,
  onDelete,
}: TaskCardProps) {
  const lineage = useTaskLineage(task.id);
  const plan = useStore((s) =>
    task.habitId == null ? "" : (s.habits.find((h) => h.id === task.habitId)?.plan ?? ""),
  );
  const value = lineage?.value;
  const hue = value ? getValueColor(value) : null;
  const travel = motion?.travel ?? null;

  const rowRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const row = rowRef.current;
    if (travel && row) row.style.setProperty("--row-h", `${row.scrollHeight}px`);
  }, [travel]);

  const menuItems = buildTaskMenuItems(task, { onOpen, onSkip, onUnskip, onDelete });

  return (
    <div ref={rowRef} className="task-row" data-task-id={task.id} data-travel={travel ?? undefined}>
      <Card
        className="task-card group relative flex flex-row items-start gap-3 rounded-[16px] bg-surface py-[13px] pe-[13px] ps-[19px]"
        style={{ "--hue": hue ?? "var(--accent)", "--stripe": hue ?? "var(--color-line)" }}
        {...buildCardStateAttributes(task.status, motion, value !== undefined)}
      >
        {value && <VoteTakeover message={buildVoteMessage(value)} />}
        <DoneCheck task={task} onToggle={onToggleDone} />

        <button
          type="button"
          onClick={() => onOpen(task)}
          className="task-card__body flex min-w-0 flex-1 flex-col items-start gap-1 text-left"
        >
          <span className="flex w-full items-center gap-2">
            <span className="task-card__title relative min-w-0">
              <span className="task-card__title-text block truncate text-sm text-foreground">
                {task.title}
              </span>
              <span className="task-card__strike" />
            </span>
            {task.status === "skip" && (
              <span className="shrink-0 rounded-full bg-surface-secondary px-1.5 py-0.5 text-xs font-medium text-muted">
                Skipped
              </span>
            )}
          </span>
          {plan !== "" && (
            <span className="max-w-full truncate text-xs text-muted" title={plan}>
              {plan}
            </span>
          )}
          <BackToItLine task={task} />

          <span className={ROW_META_CLASS}>
            {lineage && <Lineage lineage={lineage} variant="card" />}
            {task.time && (
              <span className="inline-flex items-center gap-1 text-xs tabular-nums text-muted">
                <Icon name="clock" size={11} />
                {task.time}
              </span>
            )}
            {task.detached && (
              <Icon
                name="unlink"
                size={12}
                className="text-muted"
                aria-label="Detached from habit"
              />
            )}
          </span>
        </button>

        <span className="task-card__menu flex shrink-0">
          <Menu
            isIconOnly
            touchTarget
            triggerLabel={`Actions for ${task.title}`}
            triggerClassName="-mt-1 -mb-1.5 -ms-1.5 -me-1.5 sm:mt-0.5 sm:mb-0 sm:ms-0 sm:me-0 sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100"
            triggerContent={<Icon name="dots" size={16} />}
            items={menuItems}
          />
        </span>
      </Card>
    </div>
  );
}
