import { useState } from "react";

/** Small polite live-region announcer (sighted users see these changes; SR users wouldn't). */
export function useAnnouncer() {
  const [message, setMessage] = useState("");
  const region = (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
  return { announce: setMessage, region };
}
