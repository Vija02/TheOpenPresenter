import { pluginName } from "../consts";

const scriptsPrefix = `/plugin/${pluginName}/gslide/gscripts`;
const userUploadsPrefix = `/plugin/${pluginName}/gslide/userUploads`;

/**
 * Processes HTML to replace Google URLs with local/proxy URLs
 * @param html - The raw HTML from Google
 * @param urlMapping - Mapping of original string (as in HTML) -> local media URL
 */
export function processHtml(
  html: string,
  urlMapping?: Map<string, string>,
): string {
  const scriptsPrefixEscaped = scriptsPrefix.replace(/\//g, "\\/");
  const userUploadsPrefixEscaped = userUploadsPrefix.replace(/\//g, "\\/");

  let processed = html
    .replace(
      /(?<!gscripts)\/static\/presentation\/client\//g,
      `${scriptsPrefix}/static/presentation/client/`,
    )
    .replace(/src="\//, `src="${scriptsPrefix}/`)
    .replace(/https:\/\/docs\.google\.com/g, scriptsPrefix)
    .replace(/https:\\\/\\\/docs\.google\.com/g, scriptsPrefixEscaped);

  // Now handle images/media
  if (urlMapping && urlMapping.size > 0) {
    for (const [originalString, localUrl] of urlMapping) {
      processed = processed.split(originalString).join(localUrl);
    }
  } else {
    processed = processed
      .replace(
        /https:\/\/([^.]+?)\.googleusercontent\.com/g,
        `${userUploadsPrefix}/$1`,
      )
      .replace(
        /https:\\\/\\\/([^.]+?)\.googleusercontent\.com/g,
        `${userUploadsPrefixEscaped}\\/$1`,
      );
  }

  return processed;
}
