import { type ComponentProps, lazy, Suspense, useEffect, useState } from "react";
import type { ReflectionDialog as EagerReflectionDialog } from "@/features/journal/components/ReflectionDialog";

const loadReflectionDialog = () => import("@/features/journal/components/ReflectionDialog");

const ReflectionDialog = lazy(async () => ({
  default: (await loadReflectionDialog()).ReflectionDialog,
}));

type LazyReflectionDialogProps = ComponentProps<typeof EagerReflectionDialog> & {
  shouldPrefetch: boolean;
};

/** The close-out dialog carries the rich editor, so it loads when the evening card shows, not at boot. */
export function LazyReflectionDialog({
  shouldPrefetch,
  ...dialogProps
}: LazyReflectionDialogProps) {
  const [hasOpened, setHasOpened] = useState(dialogProps.isOpen);
  if (dialogProps.isOpen && !hasOpened) setHasOpened(true);

  useEffect(() => {
    // A failed prefetch is retried by the real load, which reports through the route's error screen.
    if (shouldPrefetch) loadReflectionDialog().catch(() => undefined);
  }, [shouldPrefetch]);

  if (!hasOpened) return null;
  return (
    <Suspense fallback={null}>
      <ReflectionDialog {...dialogProps} />
    </Suspense>
  );
}
