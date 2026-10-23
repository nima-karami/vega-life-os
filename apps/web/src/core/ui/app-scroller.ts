/** The shell's `<main>` is the one element that scrolls a page; the window never does. */
export const APP_SCROLLER_ID = "main-content";

export const getAppScroller = (): HTMLElement | null => document.getElementById(APP_SCROLLER_ID);
