import { Button } from "@heroui/react";
import type { Card } from "@vega/shared";
import type { IconName } from "@/core/lib/icon-names";
import { cx, Icon } from "@/core/ui";
import { FaceHeaderRow } from "./face/CardFace";
import { FACE_HEADER, resolveFullBleedPadding } from "./face/face-metrics";
import { BARE_ROW } from "./feed-chrome";
import { buildRecallMeta, describeRecallInterval } from "./feed-steps";

const QUESTION = "Did that come back to you?";
const ANSWER_GLYPH_PX = 16;
const META_CLASS = "font-medium font-mono text-[9.5px] text-muted tracking-[.08em]";

function AnswerRow({
  icon,
  iconClass,
  label,
  labelClass,
  meta,
  onSelect,
}: {
  icon: IconName;
  iconClass: string;
  label: string;
  labelClass: string;
  meta: string;
  onSelect: () => void;
}) {
  return (
    <Button
      variant="ghost"
      onPress={onSelect}
      className={cx(BARE_ROW, "focus-visible:ring-2 focus-visible:ring-accent")}
    >
      <Icon name={icon} size={ANSWER_GLYPH_PX} className={iconClass} />
      <span className={cx("flex-1 font-medium text-[17px]", labelClass)}>{label}</span>
      <span className={META_CLASS}>{meta.toUpperCase()}</span>
    </Button>
  );
}

export function FeedRecallStep({
  card,
  typeLabel,
  category,
  narrow,
  today,
  onGrade,
}: {
  card: Card;
  typeLabel: string;
  category: string;
  narrow: boolean;
  today: string;
  onGrade: (correct: boolean) => void;
}) {
  const box = card.box ?? 1;
  const meta = buildRecallMeta(card);
  const padding = resolveFullBleedPadding(narrow);
  return (
    <div
      className="flex h-full w-full flex-col"
      style={{
        paddingTop: padding.top,
        paddingBottom: padding.bottom,
        paddingLeft: padding.left,
        paddingRight: padding.right,
      }}
    >
      <div className="invisible" aria-hidden>
        <FaceHeaderRow
          typeLabel={typeLabel}
          category={category}
          fontSize={FACE_HEADER.size}
          tracking={FACE_HEADER.tracking}
          gap={FACE_HEADER.gap}
        />
      </div>
      <div className="flex flex-1 flex-col justify-center">
        <p className="text-center font-medium text-[9px] text-muted uppercase tracking-[.24em]">
          {card.title}
        </p>
        <p className="mt-5 text-pretty text-center font-semibold text-[34px] text-foreground leading-[1.12] tracking-[-.04em]">
          {QUESTION}
        </p>
        <div className="mt-[26px] flex flex-col">
          <AnswerRow
            icon="check"
            iconClass="text-accent"
            label="Yes"
            labelClass="text-foreground"
            meta={describeRecallInterval(box, true, today)}
            onSelect={() => onGrade(true)}
          />
          <AnswerRow
            icon="repeat"
            iconClass="text-muted"
            label="Not quite"
            labelClass="text-ink-secondary"
            meta={describeRecallInterval(box, false, today)}
            onSelect={() => onGrade(false)}
          />
        </div>
        {meta.length > 0 && (
          <div className="mt-[34px] flex flex-wrap gap-x-4 gap-y-1 border-border border-t pt-4">
            {meta.map((item) => (
              <span key={item} className={META_CLASS}>
                {item}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
