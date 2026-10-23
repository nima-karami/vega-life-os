import { Button } from "@heroui/react";
import { useEffect, useState } from "react";
import { useRouteError } from "react-router";
import { BootScreen } from "./BootScreen";
import { dismissBootSplash } from "./boot-splash";
import { markChunkReload, shouldReloadForChunkError } from "./chunk-reload";

/** The root route's error screen; it also clears the boot splash, which nothing else would. */
export function RootError() {
  const error = useRouteError();
  const [isReloading, setIsReloading] = useState(() => shouldReloadForChunkError(error));

  useEffect(() => {
    if (isReloading) {
      if (markChunkReload()) window.location.reload();
      else setIsReloading(false);
      return;
    }
    dismissBootSplash({ isUrgent: true });
  }, [isReloading]);

  if (isReloading) return <BootScreen />;

  return (
    <div role="alert" className="grid h-dvh place-items-center bg-background p-4">
      <div className="flex max-w-sm flex-col items-center gap-1 text-center">
        <p className="text-base font-semibold text-foreground">VEGA stopped on an error</p>
        <p className="text-sm text-muted">Reload to start it again.</p>
        <Button className="mt-3" onPress={() => window.location.reload()}>
          Reload
        </Button>
      </div>
    </div>
  );
}
