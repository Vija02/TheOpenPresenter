import { pluginName } from "../consts";

/**
 * Processes HTML to replace Google URLs with local/proxy URLs
 * @param html - The raw HTML from Google
 * @param urlMapping - Mapping of original string (as in HTML) -> local media URL
 */
export function processHtml(
  html: string,
  urlMapping?: Map<string, string>,
): string {
  // Handle scripts
  let processed = html
    .replace(
      /\/static\/presentation\/client\//g,
      `/plugin/${pluginName}/staticScripts/static/presentation/client/`,
    )
    .replace(/src="\//, `src="/plugin/${pluginName}/staticScripts/`);

  // Now handle images/media
  if (urlMapping && urlMapping.size > 0) {
    for (const [originalString, localUrl] of urlMapping) {
      processed = processed.split(originalString).join(localUrl);
    }
  } else {
    processed = processed
      .replace(
        /https:\/\/([^.]+?)\.googleusercontent\.com/g,
        `/plugin/${pluginName}/staticProxy/$1`,
      )
      .replace(
        /https:\\\/\\\/([^.]+?)\.googleusercontent\.com/g,
        `/plugin/${pluginName}/staticProxy/$1`,
      );
  }

  return processed;
}
