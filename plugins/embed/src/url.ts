export const parseEmbedUrl = (input: string): string | null => {
  const trimmed = input.trim();
  if (trimmed === "") {
    return null;
  }

  // Reject a scheme we don't allow before the bare-host fallback below turns
  // it into something that looks valid.
  if (/^[a-z][a-z0-9+.-]*:/i.test(trimmed) && !/^https?:\/\//i.test(trimmed)) {
    return null;
  }

  let url: URL;
  try {
    url = new URL(
      /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`,
    );
  } catch {
    return null;
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return null;
  }

  if (!url.hostname.includes(".") || url.hostname.endsWith(".")) {
    return null;
  }

  return url.toString();
};
