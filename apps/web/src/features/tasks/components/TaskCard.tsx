import { Card } from "@heroui/react";
import { useLayoutEffect, useRef } from "react";
import { useStore } from "@/core/store";
import { Icon, Menu } from "@/core/ui";
import { useTaskLineage } from "@/features/tasks/lineage";
import { getValueColor } from "@/features/values/color";
import { buildVoteMessage } from "@/features/values/vote-message";
import type { Task } from "../model";
import {
  buildCardStateAttributes,
  buildTaskMenuItems,
  type CardDensity,
  type TaskCardMotion,
} from "../task-card";
import { CompactTaskBody } from "./CompactTaskBody";
import { DoneCheck } from "./DoneCheck";
import { TaskCardBody } from "./TaskCardBody";
import { VoteTakeover } from "./VoteTakeover";
import "./task-card-motion.css";
import "./task-card-keyframes.css";
import "./task-card-reduced-motion.css";

interface TaskCardProps {
  task: Task;
  /** `compact` is the slim Anytime row on Today */
  density?: CardDensity;
  /** the done moment's state on Today; absent everywhere else, so the card renders at rest */
  motion?: TaskCardMotion;
  onOpen: (t: Task) => void;
  onToggleDone: (t: Task) => void;
  onSkip: (t: Task) => void;
  onUnskip: (t: Task) => void;
  onDelete: (t: Task) => void;
}

const CARD_CLASS = {
  card: "items-start gap-3 rounded-[16px] py-[13px] pe-[13px] ps-[19px]",
  compact: "min-h-[46px] items-center gap-3 rounded-[14px] py-px pe-[14px] ps-[14px]",
} as const;

const MENU_TRIGGER_CLASS = {
  card: "-mt-1 -mb-1.5 -ms-1.5 -me-1.5 sm:mt-0.5 sm:mb-0 sm:ms-0 sm:me-0 sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100",
  compact:
    "-my-px -me-3 sm:my-0 sm:-me-1.5 sm:opacity-0 sm:focus-visible:opacity-100 sm:group-hover:opacity-100",
} as const;

/**
 * TaskCard is the Today-view card: a value-coloured stripe, the done check, the title,
 * the lineage row and the optional time; `compact` is the slim Anytime row. A valued
 * complete floods the card with the value's colour and shows the vote; the
 * `task-card-*.css` files own every beat.
 */
export function TaskCard({
  task,
  density = "card",
  motion,
  onOpen,
  onToggleDone,
  onSkip,
  onUnskip,
  onDelete,
}: TaskCardProps) {
  const lineage = useTaskLineage(task.id);
  const habit = useStore((s) =>
    task.habitId == null ? undefined : s.habits.find((h) => h.id === task.habitId),
  );
  const plan = habit?.plan ?? "";
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
    <div
      ref={rowRef}
      className="task-row"
      data-task-id={task.id}
      data-density={density}
      data-travel={travel ?? undefined}
    >
      <Card
        className={`task-card group relative flex flex-row bg-surface ${CARD_CLASS[density]}`}
        style={{ "--hue": hue ?? "var(--accent)", "--stripe": hue ?? "var(--color-line)" }}
        data-density={density}
        {...buildCardStateAttributes(task.status, motion, value !== undefined)}
      >
        {value && <VoteTakeover message={buildVoteMessage(value, motion?.isRepeatVote)} />}
        <DoneCheck task={task} density={density} onToggle={onToggleDone} />

        {density === "compact" ? (
          <CompactTaskBody
            task={task}
            icon={habit?.icon ?? "repeat"}
            plan={plan}
            value={value}
            hue={hue}
            onOpen={onOpen}
          />
        ) : (
          <TaskCardBody task={task} lineage={lineage} plan={plan} onOpen={onOpen} />
        )}

        <span className="task-card__menu flex shrink-0">
          <Menu
            isIconOnly
            touchTarget
            triggerLabel={`Actions for ${task.title}`}
            triggerClassName={MENU_TRIGGER_CLASS[density]}
            triggerContent={<Icon name="dots" size={16} />}
            items={menuItems}
          />
        </span>
      </Card>
    </div>
  );
}
