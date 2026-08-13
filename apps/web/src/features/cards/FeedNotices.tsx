import { Button } from "@heroui/react";
import type { ReactNode } from "react";
import { cx, Icon } from "@/core/ui";
import { BARE_CONTROL } from "./feed-chrome";

function FeedNotice({ title, body, cta }: { title: string; body: string; cta: ReactNode }) {
  return (
    <div className="flex h-full w-full items-center justify-center px-6">
      <div className="mx-auto max-w-md text-center">
        <h1 className="font-semibold text-2xl text-foreground tracking-tight">{title}</h1>
        <p className="mt-3 text-muted text-sm">{body}</p>
        <div className="mt-6 flex flex-col items-center gap-3">{cta}</div>
      </div>
    </div>
  );
}

export function FeedFirstRunHero({
  onAddCard,
  onOpenManager,
}: {
  onAddCard: () => void;
  onOpenManager: () => void;
}) {
  return (
    <FeedNotice
      title="Program your own scroll"
      body="Build a feed of ideas worth revisiting — heuristics, facts, tactics, vocabulary. Scroll that instead of the algorithm."
      cta={
        <>
          <Button variant="primary" onPress={onAddCard}>
            <Icon name="plus" size={15} />
            Add your first card
          </Button>
          <Button
            variant="ghost"
            onPress={onOpenManager}
            className={cx(
              BARE_CONTROL,
              "text-muted text-sm underline underline-offset-4 data-[hovered=true]:text-foreground focus-visible:ring-2 focus-visible:ring-accent",
            )}
          >
            Open the manager
          </Button>
        </>
      }
    />
  );
}

export function FeedNothingDue({ onSwitchToMix }: { onSwitchToMix: () => void }) {
  return (
    <FeedNotice
      title="Nothing is due"
      body="You are reviewing only what is due, and everything scheduled has been seen. Come back tomorrow, or mix review back into the feed."
      cta={
        <Button variant="primary" onPress={onSwitchToMix}>
          Switch to mix
        </Button>
      }
    />
  );
}

export function FeedNothingMatches({ onReset }: { onReset: () => void }) {
  return (
    <FeedNotice
      title="Nothing matches what you asked for"
      body="Your cards are all still here — what you have asked the feed to show is narrowing them to nothing."
      cta={
        <Button variant="primary" onPress={onReset}>
          Reset to everything
        </Button>
      }
    />
  );
}

export function FeedRecovery({ onRetry }: { onRetry: () => void }) {
  return (
    <FeedNotice
      title="Couldn't load your cards"
      body="Nothing was lost — they just haven't reached this screen yet."
      cta={
        <Button variant="primary" onPress={onRetry}>
          Retry
        </Button>
      }
    />
  );
}
