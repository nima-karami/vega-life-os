import { Link, Navigate, useParams } from "react-router";
import { useStore } from "@/core/store";
import { Icon, useCompact } from "@/core/ui";
import { TurnableCard } from "../face/TurnableCard";

const PREVIEW_SCALE = 0.918;

export function CardPreviewPage() {
  const { cardId } = useParams();
  const isCompact = useCompact();
  const isReady = useStore((s) => s.ready);
  const card = useStore((s) => s.cards.find((c) => c.id === cardId));

  // On a desk the card is already on the page; the preview route is a phone affordance.
  if (!isCompact) return <Navigate to={`/cards/${cardId}`} replace />;
  if (!isReady) return <div className="h-full bg-background" />;
  if (card === undefined) return <Navigate to="/cards" replace />;

  return (
    <div className="flex h-full flex-col">
      <div className="flex h-11 shrink-0 items-center gap-2 px-4 pt-12">
        <Link
          to={`/cards/${card.id}`}
          className="inline-flex items-center gap-2 text-[15px] text-muted"
        >
          <Icon name="chevL" size={18} aria-hidden />
          Edit
        </Link>
      </div>
      <div className="flex min-h-0 flex-1 items-center justify-center px-4 pt-2">
        <div
          data-testid="preview-card"
          className="relative h-[552px] w-[358px] overflow-hidden rounded-[24px] border border-border bg-surface shadow-soft"
        >
          <TurnableCard card={card} scale={PREVIEW_SCALE} />
        </div>
      </div>
    </div>
  );
}
