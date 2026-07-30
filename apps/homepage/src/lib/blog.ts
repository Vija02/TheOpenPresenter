import { getCollection, type CollectionEntry } from "astro:content";

export type BlogPost = CollectionEntry<"blog">;

/**
 * Rough reading time from the raw markdown body. 200 words per minute is the
 * usual figure for this kind of prose. Frontmatter `minutes` wins when set.
 */
export function readingMinutes(post: BlogPost): number {
  if (post.data.minutes) return post.data.minutes;

  const words = (post.body ?? "")
    .replace(/```[\s\S]*?```/g, " ") // code blocks aren't read at prose speed
    .replace(/[#>*_`~\-|]/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;

  return Math.max(1, Math.round(words / 200));
}

/** "30 July 2026" */
export function formatDate(date: Date): string {
  return date.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

/** For <time datetime="…">. */
export function isoDate(date: Date): string {
  return date.toISOString().split("T")[0]!;
}

/**
 * Published posts, newest first. Drafts show up in `astro dev` so you can
 * preview them, but never make it into the production build.
 */
export async function getPublishedPosts(): Promise<BlogPost[]> {
  const posts = await getCollection(
    "blog",
    ({ data }) => import.meta.env.DEV || !data.draft,
  );

  return posts.sort(
    (a, b) => b.data.publishDate.valueOf() - a.data.publishDate.valueOf(),
  );
}
