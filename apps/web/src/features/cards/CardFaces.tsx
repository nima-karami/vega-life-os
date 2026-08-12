import { cx, Label } from "@/core/ui";
import { CardMarkdown } from "./CardMarkdown";
import type { FeedCard } from "./feed-cards";

function getTitleSizeClass(title: string): string {
  return title.length > 120 ? "text-xl" : "text-3xl";
}

export function CardFront({ card }: { card: FeedCard }) {
  return (
    <div className="flex h-full flex-col px-8 pt-16 pb-24 text-center">
      <Label className="uppercase tracking-wide">{card.category}</Label>
      <div className="flex flex-1 flex-col items-center justify-center">
        <h2
          className={cx(
            "line-clamp-6 font-semibold tracking-tight text-foreground",
            getTitleSizeClass(card.title),
          )}
        >
          {card.title}
        </h2>
        {card.subtitle && <p className="mt-3 text-sm text-muted">{card.subtitle}</p>}
        {card.source && <p className="mt-2 text-sm text-muted">{card.source}</p>}
      </div>
    </div>
  );
}

function NoteCard({ card }: { card: FeedCard }) {
  return (
    <div className="flex h-full flex-col px-8 pt-16 pb-24 text-center">
      <Label className="uppercase tracking-wide">{card.category}</Label>
      <h2
        className={cx(
          "mt-10 font-semibold tracking-tight text-foreground",
          getTitleSizeClass(card.title),
        )}
      >
        {card.title}
      </h2>
      {card.source && <p className="mt-2 text-sm text-muted">{card.source}</p>}
      {card.body !== "" && (
        <div className="mt-6 flex-1 overflow-y-auto">
          <CardMarkdown markdown={card.body} className="journal-prose text-left" />
        </div>
      )}
    </div>
  );
}

function QuoteCard({ card }: { card: FeedCard }) {
  return (
    <div className="flex h-full flex-col px-8 pt-16 pb-24 text-center">
      <Label className="uppercase tracking-wide">{card.category}</Label>
      <div className="flex flex-1 flex-col items-center justify-center overflow-y-auto">
        <CardMarkdown
          markdown={card.body}
          className="[&_.journal-prose]:text-2xl [&_.journal-prose]:italic [&_.journal-prose]:tracking-tight"
        />
        {card.source && <p className="mt-6 text-sm text-muted">— {card.source}</p>}
      </div>
    </div>
  );
}

function PromptCard({ card }: { card: FeedCard }) {
  return (
    <div className="flex h-full flex-col px-8 pt-16 pb-24 text-center">
      <Label className="uppercase tracking-wide">{card.category}</Label>
      <div className="flex flex-1 items-center justify-center overflow-y-auto py-16">
        <CardMarkdown
          markdown={card.body}
          className="[&_.journal-prose]:text-2xl [&_.journal-prose]:tracking-tight"
        />
      </div>
    </div>
  );
}

export function SingleFaceCard({ card }: { card: FeedCard }) {
  if (card.type === "quote") return <QuoteCard card={card} />;
  if (card.type === "prompt") return <PromptCard card={card} />;
  return <NoteCard card={card} />;
}

export function CardBack({ body }: { body: string }) {
  return (
    <div className="flex h-full flex-col px-8 pt-16 pb-24">
      <div className="flex-1 overflow-y-auto">
        <CardMarkdown markdown={body} className="journal-prose text-left" />
      </div>
    </div>
  );
}

export function ReversedFront({ card }: { card: FeedCard }) {
  return (
    <div className="flex h-full flex-col px-8 pt-16 pb-24 text-center">
      <Label className="uppercase tracking-wide">{card.category}</Label>
      <div className="flex flex-1 items-center justify-center overflow-y-auto">
        <CardMarkdown markdown={card.maskedBody ?? card.body} className="journal-prose text-left" />
      </div>
      <p className="text-sm text-muted">What's this called?</p>
    </div>
  );
}

export function ReversedBack({ card, body }: { card: FeedCard; body: string }) {
  return (
    <div className="flex h-full flex-col px-8 pt-16 pb-24">
      <h2
        className={cx(
          "font-semibold tracking-tight text-foreground",
          getTitleSizeClass(card.title),
        )}
      >
        {card.title}
      </h2>
      {card.subtitle && <p className="mt-1 text-sm text-muted">{card.subtitle}</p>}
      <div className="mt-4 flex-1 overflow-y-auto">
        <CardMarkdown markdown={body} className="journal-prose text-left" />
      </div>
    </div>
  );
}
