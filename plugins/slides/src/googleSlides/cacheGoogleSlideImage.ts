import { ServerPluginApi } from "@repo/base-plugin/server";
import { logger } from "@repo/observability";
import axios from "axios";
import pLimit from "p-limit";

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
 * Returns a map of original strings (as they appear in HTML) grouped by their decoded URL
 * This ensures we only download each unique image once, even if it appears with different escaping
 */
function extractGoogleUserContentUrls(html: string): {
  decodedToOriginals: Map<string, string[]>;
  originalToDecoded: Map<string, string>;
} {
  const decodedToOriginals = new Map<string, string[]>();
  const originalToDecoded = new Map<string, string>();

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

    // Group original strings by their decoded URL
    const existingOriginals = decodedToOriginals.get(decodedUrl);
    if (existingOriginals) {
      if (!existingOriginals.includes(originalString)) {
        existingOriginals.push(originalString);
      }
    } else {
      decodedToOriginals.set(decodedUrl, [originalString]);
    }

    originalToDecoded.set(originalString, decodedUrl);
  }

  return { decodedToOriginals, originalToDecoded };
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

interface DownloadedImage {
  originalString: string;
  decodedUrl: string;
  buffer: Buffer;
  extension: string;
}

async function downloadImageFromGoogle(
  originalString: string,
  decodedUrl: string,
): Promise<DownloadedImage | null> {
  try {
    const response = await axios.get(decodedUrl, {
      responseType: "arraybuffer",
    });

    const contentType = response.headers["content-type"] || "";
    const extension = getFileExtension(contentType, decodedUrl);

    return {
      originalString,
      decodedUrl,
      buffer: Buffer.from(response.data),
      extension,
    };
  } catch (err) {
    logger.warn(
      { err, originalString, decodedUrl },
      "Failed to download image",
    );
    return null;
  }
}

async function uploadImage(
  image: DownloadedImage,
  serverPluginApi: ServerPluginApi<any, any>,
  organizationId: string,
  userId: string | null,
  parentMediaId: string,
  projectId: string,
  pluginId: string,
): Promise<string> {
  const uploadedMedia = await serverPluginApi.uploadMedia(
    image.buffer,
    image.extension,
    {
      organizationId,
      userId,
      isGuest: userId == null,
      parentMediaIdOrUUID: parentMediaId,
      attachTo: { projectId, pluginId },
    },
  );

  return `/media/data/${uploadedMedia.fileName}`;
}

export interface ImageUploadContext {
  serverPluginApi: ServerPluginApi<any, any>;
  organizationId: string;
  userId: string | null;
  projectId: string;
  pluginId: string;
}

export function createImageProcessor(
  html: string,
  ctx: ImageUploadContext,
): {
  setParentMediaId: (parentMediaId: string) => void;
  result: Promise<Map<string, string>>;
} {
  const { decodedToOriginals, originalToDecoded } =
    extractGoogleUserContentUrls(html);
  const resultMapping = new Map<string, string>();

  logger.trace(
    {
      uniqueUrlCount: decodedToOriginals.size,
      totalUrlCount: originalToDecoded.size,
    },
    "Found Google user content URLs",
  );

  let parentMediaId: string | null = null;
  let resolveParentMediaId: ((id: string) => void) | null = null;
  const parentMediaIdPromise = new Promise<string>((resolve) => {
    resolveParentMediaId = resolve;
  });

  const setParentMediaId = (id: string) => {
    parentMediaId = id;
    resolveParentMediaId?.(id);
  };

  // Process each unique image: download once, then map all original strings to the result
  const processUniqueImage = async (
    decodedUrl: string,
    originalStrings: string[],
  ): Promise<void> => {
    // Use the first original string for the download (they all decode to the same URL)
    const image = await downloadImageFromGoogle(
      originalStrings[0]!,
      decodedUrl,
    );

    if (!image) {
      // Download failed, use proxy for all original strings
      const proxyUrl = createProxyUrl(decodedUrl);
      if (proxyUrl) {
        for (const originalString of originalStrings) {
          resultMapping.set(originalString, proxyUrl);
        }
      }
      return;
    }

    // Wait for parentMediaId before uploading
    const mediaId = parentMediaId ?? (await parentMediaIdPromise);

    try {
      const localUrl = await uploadImage(
        image,
        ctx.serverPluginApi,
        ctx.organizationId,
        ctx.userId,
        mediaId,
        ctx.projectId,
        ctx.pluginId,
      );
      // Map all original strings to the same uploaded URL
      for (const originalString of originalStrings) {
        resultMapping.set(originalString, localUrl);
      }
      logger.trace(
        { decodedUrl, localUrl, originalCount: originalStrings.length },
        "Uploaded image",
      );
    } catch (err) {
      logger.warn({ err, decodedUrl }, "Failed to upload image, using proxy");
      const proxyUrl = createProxyUrl(decodedUrl);
      if (proxyUrl) {
        for (const originalString of originalStrings) {
          resultMapping.set(originalString, proxyUrl);
        }
      }
    }
  };

  // Start all downloads immediately, uploads wait for parentMediaId
  const limit = pLimit(8);
  const result = Promise.all(
    Array.from(decodedToOriginals.entries()).map(
      ([decodedUrl, originalStrings]) =>
        limit(() => processUniqueImage(decodedUrl, originalStrings)),
    ),
  ).then(() => resultMapping);

  return { setParentMediaId, result };
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

  return `/plugin/${pluginName}/gslide/userUploads/${subdomain}${path}`;
}
