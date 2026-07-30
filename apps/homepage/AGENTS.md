# Homepage App Guidelines

## Client-Side Scripts in `.astro` Components (CSP)

Our CSP blocks inline scripts (no `'unsafe-inline'`, and the per-request
nonce can't reach statically built HTML).

Astro's rule for processed `<script>` tags:
- **Has an `import`** → bundled to an external `/_astro/*.js`. Passes CSP via `'self'`.
- **No imports** → inlined into the HTML. **Blocked by CSP.**

### Rule

Put client JS in `src/scripts/*.ts` and import it from the component:

```astro
<script>
  import "../../scripts/my-component";
</script>
```

Don't use `is:inline` or `public/scripts/` for our own JS.

## Content components (guides & comparisons)

How-to guides (`src/pages/how-to/*`) and comparison pages
(`src/pages/compare/*`) are built from a shared component library in
`src/components/content/` (`ArticleLayout`, `ArticleHeader`, `Step`, `Callout`,
`Tip`, `Figure`, `FigureGrid`, `WrapUpCta`, `ContentCard`, …). Use these instead
of hand-writing page markup, and add to them rather than inlining one-offs. Full
reference and a page skeleton: `src/components/content/AGENTS.md`.

## Blog

Unlike guides and comparisons, blog posts are **markdown, not `.astro` pages**.
They live in an Astro content collection so a new post is one file.

| Piece | Path |
| --- | --- |
| Collection schema | `src/content.config.ts` |
| Posts | `src/content/blog/<slug>.md` |
| Helpers (sorting, reading time, dates) | `src/lib/blog.ts` |
| Listing page | `src/pages/blog/index.astro` |
| Post page | `src/pages/blog/[...slug].astro` |
| Feed | `src/pages/rss.xml.ts` |

### Adding a post

1. Create `src/content/blog/<slug>.md`. The filename is the URL, so
   `my-post.md` serves at `/blog/my-post`. It shows up on `/blog` and in the
   RSS feed automatically; there is no index to update.
2. Frontmatter (`title`, `description`, `category`, `publishDate` required;
   `author`, `minutes`, `updatedDate`, `cover`, `coverAlt`, `coverVideo`,
   `draft` optional). A header video uses `coverVideo` with an absolute path
   under `public/`; `cover` is a relative image import. `coverVideo` wins when
   both are set. Both render between the byline and the body.
   `description` is used three times: the meta description, the card blurb on
   `/blog`, and the lead paragraph under the H1. Write it to work as all three.
3. Reading time is estimated from the body at 200 wpm. Set `minutes` to override.
4. `draft: true` renders in `astro dev` but is dropped from the production build.

### Post assets

- **Images** go in `src/assets/images/blog/<slug>/` and are referenced with a
  relative markdown path (`![alt](../../assets/images/blog/<slug>/shot.png)`)
  so Astro optimises them.
- **Videos** go in `public/videos/blog/<slug>/` and are referenced with an
  absolute path in a raw `<video>` tag. Astro's asset pipeline doesn't process
  video, so it must be served from `public/`.

  ```html
  <video src="/videos/blog/<slug>/clip.mp4" autoplay loop muted playsinline></video>
  ```

  Don't put Tailwind classes on markdown elements. Tailwind scans `.astro`/`.ts`
  sources, and relying on it picking up `.md` is fragile. `Prose.astro` styles
  images, video, captions and code blocks already.
- An italic line straight after an image or video renders as its caption.
- The byline avatar is `src/assets/images/authors/default.jpg`, imported by
  `BlogHeader.astro`. For a second author, pass its `avatar` prop rather than
  swapping the default.

### Styling

Markdown bodies render inside `Prose.astro`, which maps `@tailwindcss/
typography` onto the house style (Red Hat Display headings, teal links,
bordered figures). Adjust styling there, not in individual posts.
