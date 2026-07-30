import type { MouseEvent as ReactMouseEvent } from "react";

/**
 * Spread onto an editor's `Modal.Backdrop` so an outside click can't discard a draft.
 * React Aria marks anything injected into the page while a modal is open (a Grammarly
 * suggestion popup) `inert`, so a click on it falls through to the backdrop underneath.
 *
 * Pressing the scrim must also not blur the dialog: React Aria scopes Escape to the
 * overlay, so focus landing on `<body>` would leave a non-dismissable modal with no
 * keyboard way out.
 */
export const draftSafeBackdrop = {
  isDismissable: false,
  onMouseDown: (event: ReactMouseEvent<HTMLElement>) => {
    if (event.target === event.currentTarget) event.preventDefault();
  },
} as const;
