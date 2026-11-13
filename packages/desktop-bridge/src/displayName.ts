const UNHELPFUL = [
  /^\s*$/,
  // Windows' device paths, eg. \\.\DISPLAY2
  /^\\\\\.\\DISPLAY\d+/i,
  /generic (non-)?pnp monitor/i,
  /^default monitor$/i,
  /^unknown( display| monitor)?$/i,
  /^color lcd$/i,
  // Linux virtual outputs. Port names like HDMI-1 are kept
  /^(xwayland|virtual)[-\w]*$/i,
];

const BUILT_IN = /^(edp|lvds)/i;

/** Eg. "EPSON PJ", or "Display 2" when the name is unhelpful */
export const displayName = (
  raw: string | null | undefined,
  index: number,
  isInternal = false,
): string => {
  const name = raw?.trim() ?? "";
  if (isInternal && UNHELPFUL.some((re) => re.test(name))) {
    return "Built-in display";
  }
  if (BUILT_IN.test(name)) return "Built-in display";
  if (UNHELPFUL.some((re) => re.test(name))) return `Display ${index + 1}`;
  return name;
};
