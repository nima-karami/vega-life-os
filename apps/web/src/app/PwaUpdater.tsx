import { useRegisterSW } from "virtual:pwa-register/react";
import { useEffect } from "react";
import { useStore } from "@/core/store";
import { browserReloadPorts, reloadWhenActivated } from "./pwa-reload";

/** Registers the service worker and surfaces new builds via the existing toast. */
export function PwaUpdater() {
  const pushActionToast = useStore((s) => s.pushActionToast);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisterError(err) {
      console.warn("SW registration failed", err);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      pushActionToast("New version available", {
        label: "Reload",
        onClick: () => reloadWhenActivated(updateServiceWorker(true), browserReloadPorts()),
      });
    }
  }, [needRefresh, pushActionToast, updateServiceWorker]);

  return null;
}
