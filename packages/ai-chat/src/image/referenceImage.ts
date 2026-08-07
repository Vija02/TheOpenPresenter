const MAX_EDGE = 1024;
const QUALITY = 0.82;

/** Refused before decoding, so a 40MB file is not read into memory to be rejected. */
export const MAX_FILE_BYTES = 12 * 1024 * 1024;

/**
 * Turns a picked file into a `data:` URL suitable for `image_url`.
 */
export const fileToReferenceImage = async (file: File): Promise<string> => {
  if (!file.type.startsWith("image/")) {
    throw new Error("That file is not an image.");
  }
  if (file.size > MAX_FILE_BYTES) {
    throw new Error("That image is too large. Use one under 12MB.");
  }

  const bitmap = await createImageBitmap(file);
  try {
    const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Could not read that image.");

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, width, height);
    ctx.drawImage(bitmap, 0, 0, width, height);

    return canvas.toDataURL("image/jpeg", QUALITY);
  } finally {
    bitmap.close?.();
  }
};

/**
 * Fetches an image by URL and re-encodes it exactly as a picked file is.
 */
export const urlToReferenceImage = async (
  candidates: string | string[],
  signal?: AbortSignal,
): Promise<string> => {
  const urls = (Array.isArray(candidates) ? candidates : [candidates]).filter(
    Boolean,
  );
  if (urls.length === 0) throw new Error("Could not load that image.");

  let lastError: unknown;
  for (const url of urls) {
    try {
      const res = await fetch(url, { signal, credentials: "include" });
      if (!res.ok) {
        lastError = new Error(`Could not load that image (${res.status}).`);
        continue;
      }

      const blob = await res.blob();
      if (blob.size > MAX_FILE_BYTES) {
        throw new Error("That image is too large. Use one under 12MB.");
      }

      const type = blob.type.startsWith("image/") ? blob.type : "image/jpeg";
      return await fileToReferenceImage(
        new File([blob], "reference", { type }),
      );
    } catch (err) {
      // A cancelled request must not silently fall through to a retry.
      if ((err as Error)?.name === "AbortError") throw err;
      lastError = err;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Could not load that image.");
};
