import { z } from "zod";

import { derivationValidator } from "./derivation";
import { hostSourceValidator } from "./element";

/** A named source of token data for a document */
export const layoutFeedValidator = z.object({
  /** Token namespace. Unique within the document. */
  name: z.string(),
  source: hostSourceValidator,
  derivation: derivationValidator.nullable(),
});

export type LayoutFeed = z.infer<typeof layoutFeedValidator>;

const FEED_NAME_ALLOWED = /[^A-Za-z0-9_]+/g;

/**
 * A name the token pattern can match. Dots separate the feed from the key, so
 * they cannot appear inside either half.
 */
export const sanitiseFeedName = (name: string): string =>
  name
    .trim()
    .replace(FEED_NAME_ALLOWED, "-")
    .replace(/^-+|-+$/g, "");

export const feedTokenKey = (feedName: string, bindingKey: string): string =>
  `${feedName}.${bindingKey}`;

export const findFeed = (
  feeds: LayoutFeed[],
  name: string,
): LayoutFeed | null => feeds.find((feed) => feed.name === name) ?? null;

export const freshFeedName = (feeds: LayoutFeed[], base: string): string => {
  const sanitised = sanitiseFeedName(base) || "feed";
  if (!findFeed(feeds, sanitised)) return sanitised;

  let n = 2;
  while (findFeed(feeds, `${sanitised}${n}`)) n += 1;
  return `${sanitised}${n}`;
};
