import "./HandoffAnimation.css";

export const HandoffAnimation = () => (
  <div
    className="rt--handoff-anim rounded-md bg-surface-secondary"
    role="img"
    aria-label="Drag the new window from your main screen onto your projector or TV, then click Go fullscreen in its bottom-right corner"
  >
    <div className="rt--handoff-anim__laptop rounded-sm border-2 border-stroke-emphasis bg-surface-primary">
      <span className="rt--handoff-anim__ui rounded-xs bg-fill-muted" />
      <span className="rt--handoff-anim__ui rt--handoff-anim__ui--2 rounded-xs bg-fill-muted" />
    </div>
    <div className="rt--handoff-anim__base bg-stroke-emphasis" />
    <span className="rt--handoff-anim__label rt--handoff-anim__label--laptop text-tertiary">
      Main screen
    </span>

    <div className="rt--handoff-anim__projector rounded-sm border-2 border-stroke-emphasis bg-surface-primary" />
    <span className="rt--handoff-anim__label rt--handoff-anim__label--projector text-tertiary">
      Projector or TV
    </span>

    <div className="rt--handoff-anim__window">
      <span className="rt--handoff-anim__titlebar" />
      <span className="rt--handoff-anim__slide" />
      <span className="rt--handoff-anim__pill">Go fullscreen</span>
    </div>

    <svg
      className="rt--handoff-anim__cursor"
      viewBox="0 0 16 22"
      aria-hidden="true"
    >
      <path
        d="M1 1v17l4.5-4.2 3 6.7 2.6-1.2-3-6.6H14z"
        fill="white"
        stroke="black"
        strokeWidth="1.3"
        strokeLinejoin="round"
      />
    </svg>
  </div>
);
