import { Button } from "@heroui/react";
import type { ReactNode } from "react";

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
