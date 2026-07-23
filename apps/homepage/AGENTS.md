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
