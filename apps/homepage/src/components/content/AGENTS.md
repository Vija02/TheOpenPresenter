# Content components

Reusable building blocks for long-form article pages: how-to guides
(`src/pages/how-to/*`) and comparisons (`src/pages/compare/*`). They were
abstracted from the shared markup those pages had in common, so every guide
looks and behaves the same and a new page is mostly data.

**Prefer these over hand-writing the markup.** If you find yourself copying a
`<section>`/`<article>`/callout block from an existing page, use the component
instead. If a page needs something none of these cover, add a component here
rather than inlining a one-off.

## House style (applies to all)

- Tailer (Tailwind v4) utility classes; teal is the accent (`teal-500`).
- Body copy: `text-gray-600 dark:text-gray-300`. Headings: `font-red-hat-display`.
- **No em dashes** in copy (house rule). Also avoid the words "genuinely" and
  "honestly" — they read as AI filler.
- Every component takes an optional `class` prop that is appended last (via
  `class:list`), so callers can tweak spacing without editing the component.

## Page skeleton

```astro
---
import ArticleLayout from "../../../components/content/ArticleLayout.astro";
import ArticleHeader from "../../../components/content/ArticleHeader.astro";
import StepsNav from "../../../components/content/StepsNav.astro";
import Step from "../../../components/content/Step.astro";
import Callout from "../../../components/content/Callout.astro";
import Tip from "../../../components/content/Tip.astro";
import Figure from "../../../components/content/Figure.astro";
import FigureGrid from "../../../components/content/FigureGrid.astro";
import WrapUpCta from "../../../components/content/WrapUpCta.astro";
import shot from "../../../assets/images/how-to/<slug>/shot.png";

const steps = [
  { id: "first", label: "Do the first thing" },
  { id: "second", label: "Do the second thing" },
];
---

<ArticleLayout title="Page title | TheOpenPresenter" description="Meta description.">
  <ArticleHeader
    backHref="/how-to"
    backLabel="All how-to guides"
    category="For churches"
    minutes={5}
    title="Page title"
  >
    Lead paragraph shown under the H1.
  </ArticleHeader>

  <Callout>Optional "Before you start" note.</Callout>

  <StepsNav steps={steps} />

  <Step id="first" number={1} title="Do the first thing">
    <p class="text-lg text-gray-600 dark:text-gray-300 mb-4">Body copy…</p>
    <Figure src={shot} alt="…" size="xl" class="mb-6" />
    <Tip>Handy aside.</Tip>
  </Step>

  <Step id="second" number={2} title="Do the second thing">…</Step>

  <WrapUpCta
    title="Closing call to action"
    buttons={[
      { label: "Primary", href: "/register", variant: "primary" },
      { label: "Secondary", href: "/church", variant: "secondary" },
    ]}
  >
    One-paragraph wrap-up.
  </WrapUpCta>
</ArticleLayout>
```

Note the import depth: from `pages/how-to/<slug>/index.astro` (three levels
deep) it is `../../../components/content/`. From a hub page like
`pages/how-to/index.astro` (two levels deep) it is `../../components/content/`.

## Components

### ArticleLayout
Wraps `DefaultLayout` + the page illustration + the section/width shell.
Replaces the boilerplate every page opened with.
- `title?`, `description?` — forwarded to `<title>` / `<meta description>`.
- `width?`: `"5xl"` (default, article pages) or `"6xl"` (listing/hub pages).
- Slot: page body.

### ArticleHeader
The back link + category label + H1 + lead paragraph for an **article** page.
(Hub/listing pages use their own centered header — see the index pages.)
- `backHref`, `backLabel` — the "All …" link with the left chevron.
- `category`, `minutes` — rendered as `Category • N min read`.
- `title` — the H1.
- Slot: lead paragraph.

### Callout
The teal "Before you start" box with an info icon.
- `title?` — default `"Before you start"`.
- `class?` — default `"mb-12"`.
- Slot: body (may contain links/`<strong>`).

### Tip
The gray aside box. Renders `Label:` then the slot.
- `label?` — default `"Tip"`. Other labels seen in guides: "Good to know",
  "That's it", "Why this matters".
- `class?` — e.g. `"mb-6"` when another element follows.
- Slot: body.

### StepsNav
The numbered "What you'll do" table of contents. Numbers are derived from
array order; each `id` must match the corresponding `<Step id>`.
- `steps`: `{ id: string; label: string }[]`.
- `heading?` — default `"What you'll do"`.

### Step
A numbered step `<article>` with a gradient number badge and an H2 title.
- `id` — anchor target (matches `StepsNav`).
- `number` — the badge number.
- `title` — the H2.
- `color?` — override the badge gradient, e.g. `"from-pink-500 to-pink-400"`.
  By default the color cycles through a palette by `number`:
  teal → purple → indigo → sky → amber → rose.
- `class?` — default `"mb-16"`.
- Slot: the step body (paragraphs, lists, `Figure`, `Tip`, …).

### Figure
A single bordered screenshot. Wraps Astro's `<Image>` with the standard frame.
- `src` (imported `ImageMetadata`), `alt`.
- `size?`: `xs | sm | md | lg | xl | 2xl | full` (default `full` — fills the
  column, e.g. inside `FigureGrid`). Non-full sizes are centered by default.
- `center?` — default `true`; set `false` to left-align (only affects non-full).
- `class?` — add margin here (the component adds none), e.g. `"mb-6"`.

### FigureGrid
A responsive row of `Figure`s (stacks on mobile). Put `Figure`s (leave them at
`size="full"`) inside.
- `cols?`: `2 | 3` (default `2`).
- `class?` — default `"mb-6"`.

### WrapUpCta
The bordered closing call-to-action card.
- `title`.
- `buttons?`: `{ label, href, variant?: "primary" | "secondary" }[]`.
- Slot: the body paragraph (constrained to `max-w-2xl`).
- `slot="footer"`: optional small print under the buttons.

### ContentCard
A single card in a hub/listing grid (`how-to/index`, `compare/index`).
- `href`, `category`, `title`, `description`.
- `minutes?` — shown as `• N min read` when present.
- `cta?` — link text, default `"Read the guide"` (comparisons use
  `"Read the comparison"`).

### ArrowIcon
The small chevron SVG reused by the back link, hub cards, etc. Pass `class` to
size/position it. You rarely use this directly — `ArticleHeader` and
`ContentCard` already do.

## Adding a page

1. Create `src/pages/<section>/<slug>/index.astro` using the skeleton above.
2. Add a matching entry to the `guides` / `comparisons` array in that section's
   `index.astro` hub so it appears in the listing.
3. Screenshots go in `src/assets/images/<section>/<slug>/` and are imported.

## Not covered here

SEO extras from the marketing brief (OpenGraph image, canonical URL,
Product/FAQPage JSON-LD) are **not** emitted by `Layout.astro` for any page.
Wiring those in is a separate, site-wide change; JSON-LD in particular needs a
CSP allowance (see the app-root `AGENTS.md`).
