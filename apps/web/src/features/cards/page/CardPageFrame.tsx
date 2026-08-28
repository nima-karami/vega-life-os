import { Button, ButtonGroup } from "@heroui/react";
import { type ReactNode, useState } from "react";
import { Link } from "react-router";
import { cx, Icon, useBelowLarge } from "@/core/ui";
import { TurnableCard } from "../face/TurnableCard";
import type { SampledCard } from "./card-sample";
import { LiveCardPane } from "./LiveCardPane";

const PREVIEW_SCALE = 0.918;

const VIEWS = [
  { id: "edit", label: "Edit" },
  { id: "preview", label: "Preview" },
] as const;

type EditorView = (typeof VIEWS)[number]["id"];

/**
 * One frame for both breakpoints: desktop is a bare two-column measure, the phone is a
 * pinned back row over its own scroller (so the footer stays put) with a 28px edge fade.
 */
export function CardPageFrame({
  preview,
  footer,
  children,
}: {
  preview: SampledCard;
  footer: ReactNode;
  children: ReactNode;
}) {
  const isSingleColumn = useBelowLarge();
  const [view, setView] = useState<EditorView>("edit");
  const isPreviewing = isSingleColumn && view === "preview";

  return (
    <div className="flex h-full flex-col sm:mx-auto sm:block sm:h-auto sm:max-w-6xl sm:px-4 sm:pt-6 sm:pb-8">
      {/* h-11 with pt-12 spills the row's children past its box; the scroller below would paint over them. */}
      <div className="relative z-10 flex h-11 shrink-0 items-center gap-2 px-4 pt-12 sm:h-auto sm:p-0">
        <Link
          to="/cards"
          className="inline-flex flex-1 items-center gap-1.5 text-[15px] text-muted transition-colors hover:text-foreground sm:flex-none sm:text-sm"
        >
          <Icon name="chevL" size={18} className="sm:hidden" aria-hidden />
          <Icon name="chevL" size={14} className="hidden sm:block" aria-hidden />
          Cards
        </Link>
        {isSingleColumn && (
          <ButtonGroup aria-label="Editor view">
            {VIEWS.map((option) => (
              <Button
                key={option.id}
                size="sm"
                variant={view === option.id ? "primary" : "secondary"}
                aria-pressed={view === option.id}
                onPress={() => setView(option.id)}
                className="h-11 px-3 font-medium text-[13px]"
              >
                {option.label}
              </Button>
            ))}
          </ButtonGroup>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col sm:block sm:min-h-0 sm:flex-none">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-1 sm:overflow-visible sm:p-0">
          <div className="flex items-start gap-8">
            <div className={cx("min-w-0 flex-1", isPreviewing && "hidden")}>{children}</div>
            {!isSingleColumn && <LiveCardPane preview={preview} />}
          </div>
          {isPreviewing && (
            <div className="flex justify-center pt-2">
              <div data-testid="preview-card" className="relative h-[552px] w-[358px] max-w-full">
                <TurnableCard
                  card={preview.card}
                  sampleSlots={preview.sampleSlots}
                  scale={PREVIEW_SCALE}
                  faceClass="rounded-[24px] border border-border shadow-soft"
                />
              </div>
            </div>
          )}
        </div>
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-canvas to-transparent sm:hidden" />
      </div>

      <div className="shrink-0 px-4 sm:px-0">{footer}</div>
    </div>
  );
}
