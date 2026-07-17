import { Icon } from "@/core/ui";

export function ConflictNote({ text }: { text: string | null }) {
  return (
    <div aria-live="polite" className="min-h-0">
      {text && (
        <p className="flex items-start gap-1.5 text-xs text-warning">
          <Icon name="alert" size={13} className="mt-0.5 shrink-0" />
          <span>{text}</span>
        </p>
      )}
    </div>
  );
}
