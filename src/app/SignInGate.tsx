import { Button, Modal, useOverlayState } from "@heroui/react";
import { signOutUser } from "@/core/auth";
import { useStore } from "@/core/store";
import { useCompactModal } from "@/core/ui";

/**
 * Shown when signing in while the local sandbox is dirty. Sign-in does not merge
 * — local data is cleared. Offer an export first; Cancel aborts the sign-in
 * (signs back out) and keeps the sandbox.
 */
export function SignInGate() {
  const pending = useStore((s) => s.pendingSignIn);
  const confirm = useStore((s) => s.confirmPendingSignIn);
  const exportJSON = useStore((s) => s.exportJSON);
  const pushToast = useStore((s) => s.pushToast);

  const doExport = () => {
    const blob = new Blob([exportJSON()], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vega-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    pushToast("Backup downloaded");
  };

  const cancel = () => {
    void signOutUser(); // abort sign-in: signs back out → onAuthChange(null) is a noop; sandbox stays intact
    useStore.setState({ pendingSignIn: null });
  };

  const responsive = useCompactModal("sm");
  const state = useOverlayState({
    isOpen: !!pending,
    onOpenChange: (next) => {
      if (!next) cancel();
    },
  });

  return (
    <Modal state={state}>
      <Modal.Backdrop variant="blur" />
      <Modal.Container {...responsive}>
        <Modal.Dialog>
          <Modal.Header>
            <Modal.Heading className="text-lg font-semibold tracking-tight">
              Use your account on this device?
            </Modal.Heading>
          </Modal.Header>
          <Modal.Body>
            <p className="text-sm leading-relaxed text-muted">
              Signing in switches to your account. The sample data currently on this device stays
              local and will be cleared — it is not uploaded. Export a backup first if you want to
              keep it.
            </p>
          </Modal.Body>
          <Modal.Footer className="flex-wrap justify-end gap-2">
            <Button variant="ghost" onPress={cancel}>
              Cancel
            </Button>
            <Button variant="outline" onPress={doExport}>
              Export backup
            </Button>
            <Button variant="primary" onPress={() => void confirm()}>
              Continue
            </Button>
          </Modal.Footer>
        </Modal.Dialog>
      </Modal.Container>
    </Modal>
  );
}
