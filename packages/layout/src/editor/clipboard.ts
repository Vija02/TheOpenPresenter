import { LayoutElement, layoutElementValidator } from "../schema/element";

const MIME = "application/x-theopenpresenter-layout";

const PAYLOAD_VERSION = 1;

type Payload = {
  kind: typeof MIME;
  version: number;
  elements: LayoutElement[];
};

/** Plain text rather than a custom MIME type */
export const serializeElements = (elements: LayoutElement[]): string =>
  JSON.stringify({
    kind: MIME,
    version: PAYLOAD_VERSION,
    elements,
  } satisfies Payload);

/** Null for anything that is not one of our payloads, including ordinary text. */
export const parseElements = (text: string): LayoutElement[] | null => {
  if (!text.includes(MIME)) return null;

  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return null;
  }

  const payload = raw as Partial<Payload> | null;
  if (
    !payload ||
    payload.kind !== MIME ||
    payload.version !== PAYLOAD_VERSION ||
    !Array.isArray(payload.elements)
  ) {
    return null;
  }

  const parsed = layoutElementValidator.array().safeParse(payload.elements);
  if (!parsed.success || parsed.data.length === 0) return null;
  return parsed.data;
};
