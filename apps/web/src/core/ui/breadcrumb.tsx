/** The ancestor trail an entity page wears in place of a single back link — every level
 *  is its own link, the page's own name is never repeated here. */
import { Link } from "react-router";
import { cx } from "./cx";
import { Icon } from "./icons";

export interface BreadcrumbItem {
  label: string;
  to: string;
}

export function EntityBreadcrumb({ trail }: { trail: BreadcrumbItem[] }) {
  return (
    <nav
      aria-label="Breadcrumb"
      className="flex min-w-0 items-center gap-1.5 text-[13px] text-muted"
    >
      <Icon name="chevL" size={14} aria-hidden className="shrink-0" />
      {trail.map((item, i) => (
        <span key={item.to} className="contents">
          {i > 0 && (
            <span aria-hidden className="shrink-0">
              ·
            </span>
          )}
          <Link
            to={item.to}
            title={item.label}
            className={cx(
              "truncate transition-colors hover:text-foreground",
              // the list level is a short literal — only user-named levels give up width
              i === 0 ? "shrink-0" : "min-w-0",
            )}
          >
            {item.label}
          </Link>
        </span>
      ))}
    </nav>
  );
}
