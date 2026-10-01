const VIEWBOX = "0 0 412 316";
const VIEWBOX_WIDTH = 412;
const VIEWBOX_HEIGHT = 316;

export function Logo({
  size = 56,
  className,
}: {
  size?: number;
  className?: string;
}) {
  return (
    <svg
      width={Math.round((size * VIEWBOX_WIDTH) / VIEWBOX_HEIGHT)}
      height={size}
      viewBox={VIEWBOX}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label="TheOpenPresenter"
      className={className ? `logo-mark ${className}` : "logo-mark"}
    >
      <rect y="48.5" width="214.9" height="214.9" fill="#303030" />
      <rect
        x="64.31"
        y="15.2"
        width="215.3"
        height="215.3"
        transform="rotate(15 64.31 15.2)"
        fill="#636363"
      />
      <rect
        x="140.7"
        y="0"
        width="215.3"
        height="215.3"
        transform="rotate(30 140.7 0)"
        fill="#A2A2A2"
      />
      <rect
        x="225.1"
        y="4.4"
        width="215.3"
        height="215.3"
        transform="rotate(45 225.1 4.4)"
        fill="#C4C4C4"
      />
      <rect
        x="304.4"
        y="21.7"
        width="215.3"
        height="215.3"
        transform="rotate(60 304.4 21.7)"
        fill="#E5E5E5"
      />
    </svg>
  );
}
