export const LogoFavicon = ({
  width,
  height,
}: {
  width?: string | number;
  height?: string | number;
}) => {
  return (
    <svg
      viewBox="0 0 420 316"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      width={width}
      height={height}
    >
      <rect y="48.501" width="214.924" height="214.924" fill="#303030" />
      <rect
        x="64.3101"
        y="15.2061"
        width="215.257"
        height="215.257"
        transform="rotate(15 64.3101 15.2061)"
        fill="#636363"
      />
      <rect
        x="140.745"
        width="215.257"
        height="215.257"
        transform="rotate(30 140.745 0)"
        fill="#A2A2A2"
      />
      <rect
        x="225.066"
        y="4.40039"
        width="215.257"
        height="215.257"
        transform="rotate(45 225.066 4.40039)"
        fill="#C4C4C4"
      />
      <rect
        x="304.371"
        y="21.6826"
        width="215.257"
        height="215.257"
        transform="rotate(60 304.371 21.6826)"
        fill="#E5E5E5"
      />
    </svg>
  );
};
