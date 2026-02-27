# Remote App Guidelines

## Preserving Query Parameters in Navigation

This app supports a proxying feature that uses query parameters (`pOrg` and `pEndpoint`) to route requests through the cloud proxy. These parameters must be preserved across all navigation and links.

### Rules

1. **Internal navigation**: Use `useNavigateWithParams()` hook from `src/hooks/useNavigateWithParams.ts` instead of wouter's `navigate()` directly. This hook automatically preserves the current search params.

2. **External links**: When constructing URLs for external links (e.g., the Present button opening the renderer), append the current search params using `useSearch()` from wouter:

   ```typescript
   const search = useSearch();
   const href = search
     ? `/render/${org}/${project}?${search}`
     : `/render/${org}/${project}`;
   ```

3. **Tauri/Desktop**: When invoking Tauri commands that open new windows, pass the search params to the URL being opened.

### Why This Matters

The proxy parameters are read from `window.location.search` by `appData.getProxyConfig()` in `@repo/lib`. If these params are stripped during navigation, subsequent API calls will fail because the proxy headers won't be set correctly.
