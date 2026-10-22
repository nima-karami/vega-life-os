export function EmptyScheduleHint({ compact }: { compact: boolean }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 top-1/3 text-center">
      <p className="text-sm text-muted">
        Nothing scheduled {compact ? "this day" : "this week"}. Click a slot to add.
      </p>
    </div>
  );
}
