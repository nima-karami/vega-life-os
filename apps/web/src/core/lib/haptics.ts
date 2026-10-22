const HAPTIC_THROTTLE_MS = 80;
const HAPTIC_PULSE_MS = 10;

let lastPulseAt: number | null = null;

export function isHapticDue(lastPulse: number | null, now: number): boolean {
  return lastPulse === null || now - lastPulse >= HAPTIC_THROTTLE_MS;
}

/** A short tick on complete; iOS has no Vibration API, so it stays silent there. */
export function pulseHaptic(): void {
  const now = Date.now();
  if (!isHapticDue(lastPulseAt, now)) return;
  lastPulseAt = now;
  try {
    navigator.vibrate?.(HAPTIC_PULSE_MS);
  } catch {
    // a blocked or unsupported vibrate must never break the toggle
  }
}
