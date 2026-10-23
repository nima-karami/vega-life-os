import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Fragment } from "react";
import { useLocation, useOutlet } from "react-router";
import { useCarriedEntityPath } from "@/core/ui";
import "./route-morph.css";
import { useRouteLayer } from "./useRouteLayer";

const EASE_OUT = [0.2, 0, 0, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;

const ROUTE_FADE = {
  initial: { opacity: 0, y: 4 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.2, ease: EASE_OUT },
    // A resting transform would be a containing block for the fixed UndoBar / BulkActionBar.
    transitionEnd: { transform: "none" },
  },
  exit: { opacity: 0, transition: { duration: 0.09, ease: EASE_IN } },
};

const REDUCED_FADE = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.14, ease: "linear" } },
  exit: { opacity: 0, transition: { duration: 0.1, ease: "linear" } },
} as const;

/**
 * Route fade between pages, except while a card → page view transition owns the swap:
 * then the layer keeps its key, so the new page commits at once for the browser to capture.
 * Capturing useOutlet() (not a bare <Outlet/>) keeps the exiting layer on the OLD route.
 */
export function PageTransition() {
  const outlet = useOutlet();
  const { pathname } = useLocation();
  const reduce = useReducedMotion();
  const layer = useRouteLayer(pathname, useCarriedEntityPath());

  return (
    // A direct load arrives still: the fade is for route changes only.
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={layer.key}
        className="h-full"
        variants={reduce ? REDUCED_FADE : ROUTE_FADE}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        <Fragment key={pathname}>{outlet}</Fragment>
      </motion.div>
    </AnimatePresence>
  );
}
