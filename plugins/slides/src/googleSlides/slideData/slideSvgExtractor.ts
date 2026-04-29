function escapeRegExp(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Extracts the SVG content for a specific slide from the HTML
 * The SVG is embedded in the HTML with clip-path IDs matching slide IDs
 */
export function extractSlideSvgContent(
  html: string,
  slideId: string,
): string | null {
  // Decode escape sequences for searching
  const decodedHtml = html
    .replace(/\\x([0-9a-fA-F]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/\\u([0-9a-fA-F]{4})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16)),
    )
    .replace(/\\\//g, "/");

  // Find the SVG group for this slide
  // Pattern: <g clip-path="url(#slideId.0)"><g id="slideId">...</g></g>
  const pattern = new RegExp(
    `<g[^>]*clip-path="url\\(#${escapeRegExp(slideId)}\\.0\\)"[^>]*>([\\s\\S]*?)<\\/g>(?=<g[^>]*clip-path|$)`,
    "i",
  );

  const match = decodedHtml.match(pattern);
  if (match) {
    return match[0];
  }

  // Alternative: try finding by g id directly
  const altPattern = new RegExp(
    `<g[^>]*id="${escapeRegExp(slideId)}"[^>]*>[\\s\\S]*?<\\/g>`,
    "i",
  );
  const altMatch = decodedHtml.match(altPattern);
  return altMatch ? altMatch[0] : null;
}
