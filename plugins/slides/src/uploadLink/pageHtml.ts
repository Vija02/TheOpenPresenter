import { pluginName } from "../consts";

/**
 * The shared import map
 */
let cachedImportMap: string | null = null;

const getImportMapTag = async (): Promise<string> => {
  if (cachedImportMap !== null && process.env.NODE_ENV === "production") {
    return cachedImportMap;
  }

  const root = process.env.ROOT_URL ?? "";

  const res = await fetch(`${root}/assets/shared/importmap.json`);
  if (!res.ok) {
    throw new Error(
      `Could not load the shared import map (${res.status}). The public ` +
        `upload page needs it to resolve react and @repo/ui.`,
    );
  }

  cachedImportMap = `<script type="importmap" nonce="INJECT_NONCE">\n${await res.text()}\n</script>`;
  return cachedImportMap;
};

/**
 * Shell for the public upload page
 */
export const renderUploadPage = async ({
  config,
}: {
  config: Record<string, unknown>;
}): Promise<string> => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Send your slides</title>
${await getImportMapTag()}
<link rel="stylesheet" href="/plugin/${pluginName}/static/uploadPage.css">
<script nonce="INJECT_NONCE">
window.__UPLOAD_CONFIG = ${JSON.stringify(config)};
</script>
</head>
<body>
<div id="pl-${pluginName}"><div id="root"></div></div>
<script type="module" src="/plugin/${pluginName}/static/${pluginName}-uploadPage.es.js" nonce="INJECT_NONCE"></script>
</body>
</html>`;

/** Standalone page for a link that can't be used. */
export const renderErrorPage = (message: string): string => `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Upload link</title>
<style>
  body {
    font-family: system-ui, -apple-system, "Segoe UI", sans-serif;
    display: flex; align-items: center; justify-content: center;
    min-height: 100vh; margin: 0; padding: 24px;
    color: #18181b; background: #fafafa;
  }
  p { max-width: 32rem; text-align: center; font-size: 16px; }
  @media (prefers-color-scheme: dark) {
    body { background: #18181b; color: #f4f4f5; }
  }
</style>
</head>
<body><p>${message}</p></body>
</html>`;
