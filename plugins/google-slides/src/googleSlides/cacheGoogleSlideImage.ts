import { ServerPluginApi } from "@repo/base-plugin/server";
import { logger } from "@repo/observability";
import axios from "axios";

import { pluginName } from "../consts";

/**
 * Decodes escape sequences in a string:
 * - \xXX (hex escapes like \x3d for =)
 * - \uXXXX (unicode escapes like \u003d for =)
 * - \/ (escaped slashes)
 */
function decodeEscapes(str: string): string {
  return str
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/\\\//g, "/");
}

/**
 * Extracts all unique googleusercontent.com URLs from HTML
 * Returns a map of original string (as it appears in HTML) -> decoded URL
 * Handles mixed escaping like: https:\/\/...\/path\x3ds2048?key\x3dxxx
 */
function extractGoogleUserContentUrls(html: string): Map<string, string> {
  const urlMap = new Map<string, string>();

  // Match URLs that may contain:
  // - \/ (escaped slashes)
  // - \xXX (hex escapes like \x3d for =)
  // - \uXXXX (unicode escapes like \u003d for =)
  // Stop at: quotes, whitespace, angle brackets, or their escaped equivalents
  // \x22 = ", \x27 = ', \x3c = <, \x3e = >
  // \u0022 = ", \u0027 = ', \u003c = <, \u003e = >
  const urlRegex =
    /https:(?:\/|\\\/)+([^.\s]+?)\.googleusercontent\.com(?:\/|\\\/)+(?:[^"'\s<>]|\\\/)*/g;

  let match;
  while ((match = urlRegex.exec(html)) !== null) {
    let originalString = match[0];

    // Trim trailing escaped characters that are URL terminators
    // \x22 or \u0022 = "
    // \x27 or \u0027 = '
    // \x3c or \u003c = <
    // \x3e or \u003e = >
    // Also handle any trailing content after an escaped quote
    originalString = originalString.replace(
      /\\x22.*$|\\u0022.*$|\\x27.*$|\\u0027.*$|\\x3c.*$|\\u003c.*$|\\x3e.*$|\\u003e.*$/i,
      "",
    );

    const decodedUrl = decodeEscapes(originalString);
    urlMap.set(originalString, decodedUrl);
  }

  return urlMap;
}

/**
 * Determines file extension from content-type header or URL
 */
function getFileExtension(contentType: string, url: string): string {
  const urlLower = url.toLowerCase();

  if (contentType.includes("image/png") || urlLower.includes(".png")) {
    return "png";
  }
  if (
    contentType.includes("image/jpeg") ||
    contentType.includes("image/jpg") ||
    urlLower.includes(".jpg") ||
    urlLower.includes(".jpeg")
  ) {
    return "jpg";
  }
  if (contentType.includes("image/gif") || urlLower.includes(".gif")) {
    return "gif";
  }
  if (contentType.includes("image/webp") || urlLower.includes(".webp")) {
    return "webp";
  }
  if (contentType.includes("image/svg") || urlLower.includes(".svg")) {
    return "svg";
  }

  return "bin";
}

async function downloadAndUploadImage({
  decodedUrl,
  serverPluginApi,
  organizationId,
  userId,
  parentMediaId,
  projectId,
  pluginId,
}: {
  decodedUrl: string;
  serverPluginApi: ServerPluginApi<any, any>;
  organizationId: string;
  userId: string;
  parentMediaId: string;
  projectId: string;
  pluginId: string;
}): Promise<string> {
  const response = await axios.get(decodedUrl, {
    responseType: "arraybuffer",
  });

  const contentType = response.headers["content-type"] || "";
  const extension = getFileExtension(contentType, decodedUrl);

  const uploadedMedia = await serverPluginApi.uploadMedia(
    Buffer.from(response.data),
    extension,
    {
      organizationId,
      userId,
      parentMediaIdOrUUID: parentMediaId,
      attachTo: { projectId, pluginId },
    },
  );

  return `/media/data/${uploadedMedia.fileName}`;
}

/**
 * Creates a fallback proxy URL for when download fails
 */
function createProxyUrl(decodedUrl: string): string | null {
  const subdomain = decodedUrl.match(
    /https:\/\/([^.]+?)\.googleusercontent\.com/,
  )?.[1];

  if (!subdomain) {
    return null;
  }

  const path = decodedUrl.replace(
    /https:\/\/[^.]+?\.googleusercontent\.com/,
    "",
  );

  return `/plugin/${pluginName}/staticProxy/${subdomain}${path}`;
}

/**
 * Extracts Google user content URLs from HTML, downloads them,
 * uploads to media system, and returns a mapping for replacement
 */
export async function cacheGoogleUserContentImages(
  html: string,
  params: {
    serverPluginApi: ServerPluginApi<any, any>;
    organizationId: string;
    userId: string;
    parentMediaId: string;
    projectId: string;
    pluginId: string;
  },
): Promise<Map<string, string>> {
  const urlMap = extractGoogleUserContentUrls(html);
  const resultMapping = new Map<string, string>();

  logger.trace({ urlCount: urlMap.size }, "Found Google user content URLs");

  await Promise.all(
    Array.from(urlMap.entries()).map(async ([originalString, decodedUrl]) => {
      try {
        const localUrl = await downloadAndUploadImage({
          decodedUrl,
          ...params,
        });
        resultMapping.set(originalString, localUrl);
        logger.trace(
          { originalString, decodedUrl, localUrl },
          "Uploaded image",
        );
      } catch (err) {
        logger.warn(
          { err, originalString, decodedUrl },
          "Failed to download/upload image, using proxy",
        );

        const proxyUrl = createProxyUrl(decodedUrl);
        if (proxyUrl) {
          resultMapping.set(originalString, proxyUrl);
        }
      }
    }),
  );

  return resultMapping;
}
