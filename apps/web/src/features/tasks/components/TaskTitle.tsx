/** The title with the strike the done moment draws across it. */
export function TaskTitle({ title }: { title: string }) {
  return (
    <span className="task-card__title relative min-w-0">
      <span className="task-card__title-text block truncate text-sm text-foreground">{title}</span>
      <span className="task-card__strike" />
    </span>
  );
}
