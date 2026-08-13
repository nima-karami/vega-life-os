import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router";
import { useStore } from "@/core/store";
import { UndoBar } from "@/core/ui";
import type { CardPageLocationState } from "./page/card-page-nav";

const UNDO_MS = 8_000;

/** Renders the undo a destructive action on another route handed over in route state. */
export function RouteUndoBar() {
  const { state, pathname } = useLocation() as {
    state: CardPageLocationState | null;
    pathname: string;
  };
  const navigate = useNavigate();
  const restoreCard = useStore((s) => s.restoreCard);
  const [pending, setPending] = useState(state?.cardUndo ?? null);

  useEffect(() => {
    setPending(state?.cardUndo ?? null);
  }, [state?.cardUndo]);

  useEffect(() => {
    if (pending === null) return;
    const timer = setTimeout(() => {
      setPending(null);
      navigate(pathname, { replace: true, state: null });
    }, UNDO_MS);
    return () => clearTimeout(timer);
  }, [pending, navigate, pathname]);

  if (pending === null) return null;
  return (
    <UndoBar
      tone="ink"
      message={pending.message}
      onUndo={() => {
        restoreCard(pending.card);
        setPending(null);
        navigate(pathname, { replace: true, state: null });
      }}
    />
  );
}
