import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useLocation, useOutlet } from "react-router";

const EASE_OUT = [0.22, 1, 0.36, 1] as const;
const EASE_IN = [0.4, 0, 1, 1] as const;

/**
 * Calm blur+fade between routes. Capturing useOutlet() (not a bare <Outlet/>)
 * keeps the exiting page showing the OLD route during its blur-out under a data
 * router + mode="wait"; a live <Outlet/> would repaint it with the new page.
 */
export function PageTransition() {
  const outlet = useOutlet();
  const { pathname } = useLocation();
  const reduce = useReducedMotion();

  const variants = reduce
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.14 } },
        exit: { opacity: 0, transition: { duration: 0.1 } },
      }
    : {
        initial: { opacity: 0, filter: "blur(10px)" },
        animate: {
          opacity: 1,
          filter: "blur(0px)",
          transition: { duration: 0.45, ease: EASE_OUT },
          // Drop the filter at rest so it stops being a containing block for the
          // page's fixed-position bars (UndoBar / BulkActionBar).
          transitionEnd: { filter: "none" },
        },
        exit: {
          opacity: 0,
          filter: "blur(10px)",
          transition: { duration: 0.3, ease: EASE_IN },
        },
      };

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={pathname}
        className="h-full"
        variants={variants}
        initial="initial"
        animate="animate"
        exit="exit"
      >
        {outlet}
      </motion.div>
    </AnimatePresence>
  );
}
