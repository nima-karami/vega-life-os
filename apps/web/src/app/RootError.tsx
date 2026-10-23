import { Button } from "@heroui/react";
import { useEffect } from "react";
import { dismissBootSplash } from "./boot-splash";

/** The root route's error screen; it also clears the boot splash, which nothing else would. */
export function RootError() {
  useEffect(() => {
    dismissBootSplash({ isUrgent: true });
  }, []);

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
