/** The index.html splash held still, for any wait on the store; its CSS lives in index.html.
 *  It renders under the live splash too, so losing the splash early never leaves a blank page. */
export function BootScreen() {
  return (
    <div className="boot" data-state="static" aria-hidden="true">
      <div className="boot-stage">
        <svg className="boot-tile" width="64" height="64" viewBox="0 0 32 32" aria-hidden="true">
          <rect width="32" height="32" rx="6" fill="#1b1b16" />
          <path
            className="boot-v"
            pathLength={100}
            d="M8 9 L16 23 L24 9"
            fill="none"
            stroke="#f2efe6"
            strokeWidth="3"
            strokeLinecap="square"
            strokeLinejoin="miter"
          />
        </svg>
        <div className="boot-word">VEGA</div>
        <div className="boot-line">
          <div className="boot-tag">Live your values</div>
        </div>
      </div>
    </div>
  );
}
