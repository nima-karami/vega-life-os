import { Label } from "@/core/ui";

export function Placeholder({ title, note }: { title: string; note?: string }) {
  return (
    <div className="grid h-full place-items-center p-10">
      <div className="flex flex-col items-center gap-3 text-center">
        <Label>// {title}</Label>
        <p className="display text-3xl text-mist">Coming online</p>
        {note && <p className="mono max-w-sm text-[11px] text-stone">{note}</p>}
      </div>
    </div>
  );
}
