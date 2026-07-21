import { Button } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { getTrpcClient } from "@/core/persistence/trpc-client";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";

type ConnectPhase = "connecting" | "connected" | "error";

const RETURN_DELAY_MS = 1200;

export function CalendarCallbackPage() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const setEnabled = useStore((s) => s.setGcalEnabled);
  const setWriteCalendarId = useStore((s) => s.setGcalWriteCalendarId);
  const [phase, setPhase] = useState<ConnectPhase>("connecting");
  const started = useRef(false);

  useEffect(() => {
    // Google sends one authorization code; a reused code fails, so guard against
    // React's double-invoke and never exchange twice.
    if (started.current) return;
    started.current = true;

    const code = params.get("code");
    if (!code) {
      setPhase("error");
      return;
    }

    void (async () => {
      try {
        const result = await getTrpcClient().calendar.oauthCallback.mutate({
          code,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        });
        setEnabled(true);
        setWriteCalendarId(result.writeCalendarId);
        setPhase("connected");
        setTimeout(() => navigate("/settings", { replace: true }), RETURN_DELAY_MS);
      } catch {
        setPhase("error");
      }
    })();
  }, [params, navigate, setEnabled, setWriteCalendarId]);

  return (
    <div className="mx-auto grid h-full min-h-[60vh] max-w-3xl place-items-center p-10">
      <div className="flex max-w-sm flex-col items-center gap-4 text-center">
        {phase === "connecting" && (
          <>
            <Icon name="refresh-cw" size={28} className="animate-spin text-accent" />
            <p className="text-lg font-semibold tracking-tight text-foreground">
              Connecting your calendar…
            </p>
            <p className="text-sm text-muted">Finishing the handoff from Google.</p>
          </>
        )}

        {phase === "connected" && (
          <>
            <Icon name="calendar-check" size={28} className="text-success" />
            <p className="text-lg font-semibold tracking-tight text-foreground">
              Calendar connected ✅
            </p>
            <p className="text-sm text-muted">Taking you back to Settings…</p>
          </>
        )}

        {phase === "error" && (
          <>
            <Icon name="alert" size={28} className="text-danger" />
            <p className="text-lg font-semibold tracking-tight text-foreground">
              Couldn’t connect your calendar
            </p>
            <p className="text-sm text-muted">
              The Google handoff didn’t complete. Head back to Settings and try connecting again.
            </p>
            <Button variant="primary" onPress={() => navigate("/settings", { replace: true })}>
              <Icon name="calendar" size={15} />
              Back to Settings
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
