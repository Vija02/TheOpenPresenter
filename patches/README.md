# Patches

We keep a list of the changes here to keep track of what we did

## @hocuspocus/server

Patched so that we can push changes from the server. Previously, these changes would be ignored.

## graphql

Remove the .mjs entry to force bundler to use the cjs build. This was causing us build issues.

## pkgroll

Applied this PR: https://github.com/privatenumber/pkgroll/pull/73 so that we can use the feature to build our `worker` files. And we use pkgroll to handle ESM/CJS issues (Yjs).

## vite-express

Fixed 2 issues:
1. https://github.com/szymmis/vite-express/pull/140 (now published but still in this patch)
2. The package is using global state. Since we use this for both our `remote` and `renderer`. It was clashing. So this patch also wraps them into a class to fix the issue.