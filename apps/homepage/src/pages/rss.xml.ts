import type { APIRoute } from "astro";

import { getPublishedPosts } from "../lib/blog";

// Hand-rolled so the app doesn't need @astrojs/rss for one endpoint.
function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export const GET: APIRoute = async ({ site }) => {
  const base = (site ?? new URL("https://theopenpresenter.com")).origin;
  const posts = await getPublishedPosts();

  const items = posts
    .map((post) => {
      const url = `${base}/blog/${post.id}`;
      return [
        "    <item>",
        `      <title>${escapeXml(post.data.title)}</title>`,
        `      <link>${escapeXml(url)}</link>`,
        `      <guid isPermaLink="true">${escapeXml(url)}</guid>`,
        `      <description>${escapeXml(post.data.description)}</description>`,
        `      <pubDate>${post.data.publishDate.toUTCString()}</pubDate>`,
        `      <category>${escapeXml(post.data.category)}</category>`,
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>TheOpenPresenter Blog</title>
    <link>${base}/blog</link>
    <description>Product updates and notes from building free, open source presentation software.</description>
    <language>en</language>
    <atom:link href="${base}/rss.xml" rel="self" type="application/rss+xml" />
${items}
  </channel>
</rss>
`;

  return new Response(xml, {
    headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
  });
};
