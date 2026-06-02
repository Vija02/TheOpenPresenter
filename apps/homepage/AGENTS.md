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
