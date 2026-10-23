import { onAuth } from "@/core/auth";
import { useStore } from "@/core/store";

let isAuthSyncStarted = false;

/** Called from the entry module, so the store boots while a direct load's route chunk is in flight. */
export function startAuthSync(): void {
  if (isAuthSyncStarted) return;
  isAuthSyncStarted = true;
  onAuth((user) => {
    void useStore.getState().onAuthChange(user?.uid ?? null);
  });
}
