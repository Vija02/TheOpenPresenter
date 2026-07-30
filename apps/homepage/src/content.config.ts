import { glob } from "astro/loaders";
import { defineCollection, z } from "astro:content";

// Blog posts live in `src/content/blog/*.md`. The file name becomes the slug,
// so `first-post.md` is served at `/blog/first-post`.
const blog = defineCollection({
  loader: glob({ base: "./src/content/blog", pattern: "**/*.md" }),
  schema: ({ image }) =>
    z.object({
      title: z.string(),
      // Shown on the card in /blog and used as the meta description.
      description: z.string(),
      // Small uppercase label above the title. Keep the set small so the hub
      // page stays scannable, e.g. "Product", "Behind the scenes", "Churches".
      category: z.string().default("Product"),
      publishDate: z.coerce.date(),
      updatedDate: z.coerce.date().optional(),
      author: z.string().default("TheOpenPresenter"),
      // Reading time is estimated from the body. Set this to override it.
      minutes: z.number().int().positive().optional(),
      // Drafts render in `astro dev` but are left out of the production build.
      draft: z.boolean().default(false),
      // Optional header image, relative to the markdown file.
      cover: image().optional(),
      coverAlt: z.string().optional(),
      // Optional header video. Astro's asset pipeline doesn't process video, so
      // this is an absolute path into `public/`, not a relative import.
      // Takes precedence over `cover` when both are set.
      coverVideo: z
        .string()
        .startsWith("/", "coverVideo must be an absolute path under public/")
        .optional(),
    }),
});

export const collections = { blog };
