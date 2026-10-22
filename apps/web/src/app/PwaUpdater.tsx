import { useRegisterSW } from "virtual:pwa-register/react";
import { useEffect, useRef } from "react";
import { useStore } from "@/core/store";
import { reloadIntoWaitingWorker, scheduleUpdateChecks } from "./pwa-update";

/** Registers the service worker and surfaces new builds via the existing toast. */
export function PwaUpdater() {
  const pushActionToast = useStore((s) => s.pushActionToast);
  const registrationRef = useRef<ServiceWorkerRegistration | undefined>(undefined);
  const {
    needRefresh: [needRefresh],
    updateServiceWorker,
  } = useRegisterSW({
    onRegisteredSW(_swUrl, registration) {
      if (!registration) return;
      registrationRef.current = registration;
      scheduleUpdateChecks(registration);
    },
    onRegisterError(err) {
      console.warn("SW registration failed", err);
    },
  });

  useEffect(() => {
    if (needRefresh) {
      pushActionToast("New version available", {
        label: "Reload",
        onClick: () =>
          reloadIntoWaitingWorker(registrationRef.current, () => updateServiceWorker(true)),
      });
    }
  }, [needRefresh, pushActionToast, updateServiceWorker]);

  return null;
}
