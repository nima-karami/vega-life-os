import type { VoteMessage } from "@/features/values/vote-message";

/** Always mounted on a valued card: the flood and lines are transitions, which never run on mount. */
export function VoteTakeover({ message }: { message: VoteMessage }) {
  return (
    <>
      <span className="task-card__flood" />
      <span className="task-card__message" aria-hidden="true">
        <span className="task-card__headline">{message.headline}</span>
        {message.identity !== null && (
          <span className="task-card__identity">{message.identity}</span>
        )}
      </span>
    </>
  );
}
