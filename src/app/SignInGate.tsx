import { Button, Modal, ModalBody, ModalContent, ModalFooter, ModalHeader } from "@heroui/react";
import { signOutUser } from "@/core/auth";
import { useStore } from "@/core/store";

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

  return (
    <Modal isOpen={!!pending} onClose={cancel} placement="center" backdrop="blur" size="sm">
      <ModalContent>
        <ModalHeader className="text-large font-semibold tracking-tight">
          Use your account on this device?
        </ModalHeader>
        <ModalBody>
          <p className="text-small leading-relaxed text-default-500">
            Signing in switches to your account. The sample data currently on this device stays
            local and will be cleared — it is not uploaded. Export a backup first if you want to
            keep it.
          </p>
        </ModalBody>
        <ModalFooter className="flex-wrap justify-end gap-2">
          <Button variant="light" onPress={cancel}>
            Cancel
          </Button>
          <Button variant="bordered" onPress={doExport}>
            Export backup
          </Button>
          <Button color="primary" onPress={() => void confirm()}>
            Continue
          </Button>
        </ModalFooter>
      </ModalContent>
    </Modal>
  );
}
