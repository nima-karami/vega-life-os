import { PageShell, type PageShellProps } from "@/core/ui";
import { FinanceViewNav } from "./FinanceViewNav";

/** Every finance page wears the same frame, so the view strip is part of the frame. */
export function FinancePageShell(props: Omit<PageShellProps, "nav">) {
  return <PageShell {...props} nav={<FinanceViewNav />} />;
}
