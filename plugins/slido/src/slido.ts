export const PRESENT_HOST = "wall.sli.do";
export const ADMIN_HOST = "admin.sli.do";

export type ParsedSlidoInput = {
  eventCode: string;
  section: string | null;
};

const EVENT_CODE_PATTERN = /^[A-Za-z0-9_-]{4,64}$/;

/**
 * Accepts anything an operator is likely to paste:
 *
 * - a present mode link (https://wall.sli.do/event/<hash>)
 * - a participant link (https://app.sli.do/event/<hash>/questions)
 * - a host link (https://admin.sli.do/event/<hash>/polls)
 * - a room link with a `section` query param
 * - a bare join code (#1234567 or 1234567)
 *
 * Returns null when nothing usable can be read out of the input.
 */
export const parseSlidoInput = (input: string): ParsedSlidoInput | null => {
  const trimmed = input.trim();
  if (trimmed === "") {
    return null;
  }

  if (
    /^https?:\/\//i.test(trimmed) ||
    /^[a-z0-9.-]+\.sli\.do\//i.test(trimmed)
  ) {
    return parseSlidoUrl(trimmed);
  }

  const code = trimmed.replace(/^#/, "");
  if (!EVENT_CODE_PATTERN.test(code)) {
    return null;
  }

  return { eventCode: code, section: null };
};

const parseSlidoUrl = (input: string): ParsedSlidoInput | null => {
  let url: URL;
  try {
    url = new URL(/^https?:\/\//i.test(input) ? input : `https://${input}`);
  } catch {
    return null;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const eventIndex = segments.indexOf("event");
  const eventCode = eventIndex === -1 ? segments[0] : segments[eventIndex + 1];

  if (!eventCode || !EVENT_CODE_PATTERN.test(eventCode)) {
    return null;
  }

  return {
    eventCode,
    section: url.searchParams.get("section"),
  };
};

/** The results wall */
export const buildSlidoUrl = ({
  eventCode,
  section,
}: {
  eventCode: string;
  section?: string | null;
}): string => {
  const url = new URL(`https://${PRESENT_HOST}/event/${eventCode}`);
  if (section) {
    url.searchParams.set("section", section);
  }

  return url.toString();
};

export const buildSlidoAdminUrl = (eventCode: string): string =>
  `https://${ADMIN_HOST}/event/${eventCode}`;
