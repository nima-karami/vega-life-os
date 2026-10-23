import { Button } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { formatRelativeDay, todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";
import { CARRY_START_MS, DEPARTURE_END_MS, type GratitudeDeparture } from "../gratitude-carry";
import { aimCarry } from "./aim-carry";
import { GratitudeFields } from "./GratitudeFields";
import "./gratitude-step.css";

type CarryMode = "aim" | "fade";

/**
 * Full-screen daily gratitude prompt, laid over the shell. Continue saves what was written
 * (or skips the day if nothing was) at once; the departure then plays over the routed page,
 * which is already mounted underneath, and `onLeft` takes the layer down.
 */
export function GratitudeStep({
  date,
  onLeave,
  onLeft,
}: {
  date: string;
  onLeave: () => void;
  onLeft: () => void;
}) {
  const upsertDayEntry = useStore((s) => s.upsertDayEntry);
  const acknowledgeGratitudeNudge = useStore((s) => s.acknowledgeGratitudeNudge);
  const [slots, setSlots] = useState<string[]>([]);
  const [departure, setDeparture] = useState<GratitudeDeparture | null>(null);
  const [carry, setCarry] = useState<CarryMode | null>(null);
  const layerRef = useRef<HTMLDivElement>(null);

  const submit = () => {
    if (departure) return;
    const isEmpty = !slots.some((s) => s.trim() !== "");
    onLeave();
    setDeparture(isEmpty ? "skip" : "kept");
    if (isEmpty) {
      acknowledgeGratitudeNudge(date);
      return;
    }
    // immediate: a debounced save lost to a fast reload would bring the page back
    upsertDayEntry(date, { gratitude: slots }, { immediate: true });
  };

  useEffect(() => {
    if (!departure) return;
    const timers = [setTimeout(onLeft, DEPARTURE_END_MS[departure])];
    if (departure === "kept") {
      timers.push(
        setTimeout(() => {
          const layer = layerRef.current;
          setCarry(layer && aimCarry(layer) ? "aim" : "fade");
        }, CARRY_START_MS),
      );
    }
    return () => {
      for (const timer of timers) clearTimeout(timer);
    };
  }, [departure, onLeft]);

  return (
    <div
      ref={layerRef}
      className="gratitude-layer fixed inset-0 z-30"
      data-departure={departure ?? undefined}
      data-carry={carry ?? undefined}
    >
      <div className="gratitude-layer__backdrop absolute inset-0 bg-background" />
      <div className="safe-inset-x safe-pt relative h-full overflow-y-auto overflow-x-hidden">
        <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center px-4 py-6 sm:py-10">
          <section
            aria-label="Morning gratitude"
            inert={departure !== null}
            className="gratitude-step flex w-full max-w-md flex-col gap-6 px-4 py-10"
          >
            <div className="flex flex-col items-center gap-3 text-center">
              <div className="gratitude-fade grid h-12 w-12 place-items-center rounded-full bg-surface-secondary text-accent">
                <span className="gratitude-heart">
                  <Icon name="heart" size={22} />
                  <Icon name="heart" size={22} className="gratitude-heart__fill fill-current" />
                </span>
              </div>
              <div className="gratitude-fade">
                <p className="text-sm text-muted">{formatRelativeDay(date, todayISO())}</p>
                <h1 className="text-2xl font-semibold tracking-tight text-foreground">
                  What are you grateful for today?
                </h1>
              </div>
            </div>

            <GratitudeFields value={slots} onChange={setSlots} autoFocus />

            <Button variant="primary" size="lg" className="gratitude-fade w-full" onPress={submit}>
              Continue
            </Button>
          </section>
        </div>
      </div>
    </div>
  );
}
