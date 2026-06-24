import { useEffect, useRef } from "react";
import { sanitizeMarkdownToFragment } from "./markdown";

/**
 * Render stored journal Markdown read-only. Sanitized via an allowlist (DOMPurify)
 * and mounted as a DOM fragment through a ref — no innerHTML string, no raw HTML.
 */
export function JournalReadonly({ markdown, className }: { markdown: string; className?: string }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.replaceChildren(sanitizeMarkdownToFragment(markdown));
  }, [markdown]);

  return <div ref={ref} className={`journal-prose ${className ?? ""}`} />;
}
