import { useReducedMotion } from "framer-motion";
import { Link } from "react-router";
import { useStore } from "@/core/store";
import {
  CardFill,
  cx,
  Disclosure,
  ENTITY_MORPH_STYLE,
  Icon,
  Menu,
  useIsEntityCarried,
} from "@/core/ui";
import { getValueCardFill } from "../color";
import type { Value } from "../model";
import { splitGoals } from "../selectors";
import { ValueGoalRow } from "./ValueGoalRow";

export interface ValueCardActions {
  onAddGoal: () => void;
  onArchiveToggle: () => void;
  onSeasonToggle: () => void;
  onDelete: () => void;
  onAnnounce: (message: string) => void;
}

/** The value *is* the card, so the value takes the colour: its goals and habits live
 *  inside it. At 390 the card is loosened rather than shrunk. */
export function ValueIndexCard({
  value,
  archived,
  resting = false,
  onAddGoal,
  onArchiveToggle,
  onSeasonToggle,
  onDelete,
  onAnnounce,
}: { value: Value; archived: boolean; resting?: boolean } & ValueCardActions) {
  const goals = useStore((s) => s.goals);
  const habits = useStore((s) => s.habits);

  const valueGoals = goals.filter((g) => g.valueId === value.id).sort((a, b) => a.order - b.order);
  const { open, closed } = splitGoals(valueGoals);
  const loose = habits.filter((h) => h.valueId === value.id && !h.goalId);
  const fill = getValueCardFill(value);
  const path = `/values/${value.id}`;
  const isCarried = useIsEntityCarried(path);
  const isMotionReduced = useReducedMotion() ?? false;

  return (
    <div
      className={cx(
        "relative isolate rounded-[16px] border border-transparent p-[22px] sm:p-5",
        archived && "opacity-60",
        resting && "opacity-80",
      )}
    >
      <CardFill fill={fill} isCarried={isCarried} />
      <div className="flex items-start gap-4">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[.18] text-white">
          <Icon
            name={value.icon}
            size={18}
            style={isCarried ? ENTITY_MORPH_STYLE.icon : undefined}
          />
        </span>
        <Link to={path} viewTransition={!isMotionReduced} className="min-w-0 flex-1 outline-none">
          <span className="flex items-center gap-1.5 text-[19px] font-semibold leading-[1.25] text-white sm:text-[18px]">
            <span style={isCarried ? ENTITY_MORPH_STYLE.title : undefined}>{value.name}</span>
            {resting && <Icon name="moon" size={14} aria-label="Resting" />}
          </span>
          <span className="mt-1 block break-words text-[14px] leading-[1.6] text-white/[.86] sm:leading-[1.5]">
            {value.desc || "No description yet."}
          </span>
        </Link>
        <Menu
          align="end"
          isIconOnly
          touchTarget
          tone="inherit"
          triggerLabel={`${value.name} actions`}
          triggerClassName="-mt-1.5 -me-1.5 text-white/[.86] hover:bg-white/10 hover:text-white data-[hovered=true]:text-white sm:mt-0 sm:me-0"
          triggerContent={<Icon name="dots" size={16} />}
          items={
            archived
              ? [
                  { label: "Unarchive", icon: "archive", onSelect: onArchiveToggle },
                  { label: "Delete value", icon: "trash", danger: true, onSelect: onDelete },
                ]
              : [
                  { label: "Add goal", icon: "plus", onSelect: onAddGoal },
                  {
                    label: resting ? "Bring into season" : "Rest this value",
                    icon: "moon",
                    onSelect: onSeasonToggle,
                  },
                  { label: "Archive", icon: "archive", onSelect: onArchiveToggle },
                  { label: "Delete value", icon: "trash", danger: true, onSelect: onDelete },
                ]
          }
        />
      </div>

      <div className="mt-[26px] sm:mt-[18px]">
        <CardLabel>Goals</CardLabel>
        <div className="mt-1.5">
          {open.map((g) => (
            <ValueGoalRow key={g.id} goal={g} />
          ))}

          {!archived && (
            <button
              type="button"
              onClick={onAddGoal}
              className={cx(
                "flex w-full items-center gap-2 pb-0.5 pt-3 text-[13px] text-white/[.86] transition-colors hover:text-white",
                open.length > 0 && "border-t border-white/20",
              )}
            >
              <Icon name="plus" size={14} />
              Add goal
            </button>
          )}

          {closed.length > 0 && (
            <div className="mt-3.5">
              <Disclosure
                onCard
                label="closed"
                count={closed.length}
                onToggle={(shown) =>
                  onAnnounce(shown ? `${closed.length} closed goals shown` : "Closed goals hidden")
                }
              >
                {closed.map((g) => (
                  <ValueGoalRow key={g.id} goal={g} />
                ))}
              </Disclosure>
            </div>
          )}
        </div>
      </div>

      {loose.length > 0 && (
        <div className="mt-[26px] sm:mt-5">
          <CardLabel>Habits</CardLabel>
          <div className="mt-2.5 flex flex-wrap gap-2">
            {loose.map((h) => (
              <Link
                key={h.id}
                to={`/habits/${h.id}`}
                className="inline-flex items-center gap-1.5 rounded-full bg-white/[.18] px-[11px] py-1.5 text-[13px] text-white outline-none transition-colors hover:bg-white/[.28] sm:py-1"
              >
                <Icon name={h.icon} size={13} className="text-white/[.86]" />
                {h.name}
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CardLabel({ children }: { children: string }) {
  return (
    <span className="block text-[12px] font-medium uppercase tracking-[.06em] text-white/[.86]">
      {children}
    </span>
  );
}
