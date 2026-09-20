import { LayoutDoc } from "../schema/document";
import { LayoutFeed } from "../schema/feed";
import { FrameData } from "./spans";
import { extractTokenKeys } from "./tokens";

/** Every token key a document references, across text content and image fills. */
export const docTokenKeys = (doc: LayoutDoc): string[] => {
  const keys: string[] = [];

  const collect = (template: string) => {
    for (const key of extractTokenKeys(template)) {
      if (!keys.includes(key)) keys.push(key);
    }
  };

  for (const element of doc.elements) {
    if (element.type === "text") collect(element.content);
    if (
      element.fill?.type === "image" &&
      typeof element.fill.src === "string"
    ) {
      collect(element.fill.src);
    }
  }

  return keys;
};

/** What each feed resolved to, keyed by feed name. */
export type FeedFrames = Record<string, FrameData>;

export const namespaceFeedData = (frames: FeedFrames): FrameData => {
  const out: FrameData = {};
  for (const [feedName, data] of Object.entries(frames)) {
    for (const [key, value] of Object.entries(data)) {
      out[`${feedName}.${key}`] = value;
    }
  }
  return out;
};

/** Feeds the document actually reads. The rest are never resolved. */
export const activeFeeds = (doc: LayoutDoc): LayoutFeed[] => {
  const feeds = doc.feeds ?? [];
  if (feeds.length === 0) return [];

  const prefixes = new Set(
    docTokenKeys(doc)
      .map((key) => key.split(".")[0])
      .filter((name): name is string => name !== undefined),
  );
  return feeds.filter((feed) => prefixes.has(feed.name));
};
