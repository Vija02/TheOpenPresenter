import axios from "axios";

import { POWERPOINT_EXTENSION_BY_MIME } from "./driveMimeTypes";
import { googleUrl } from "./oauth";

const MAX_BYTES = 500 * 1024 * 1024;

const driveFileUrl = (fileId: string, query: string) =>
  googleUrl(
    `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?${query}`,
  );

/**
 * Whether a picked Drive file is a PowerPoint rather than a Google Slides
 * deck. Anything we can't tell about is treated as a Slides deck, so the
 * usual import runs and reports its own errors.
 */
export const getDrivePowerPointType = async (
  fileId: string,
  token: string,
): Promise<{ extension: "pptx" | "ppt"; name: string | null } | null> => {
  try {
    const meta = await axios.get(
      driveFileUrl(fileId, "fields=name,mimeType&supportsAllDrives=true"),
      {
        headers: { Authorization: `Bearer ${token}` },
        validateStatus: () => true,
      },
    );
    if (meta.status !== 200) return null;

    const { mimeType, name } = meta.data as {
      mimeType?: string;
      name?: string;
    };
    const extension = mimeType
      ? POWERPOINT_EXTENSION_BY_MIME[mimeType]
      : undefined;
    return extension ? { extension, name: name ?? null } : null;
  } catch {
    return null;
  }
};

export const downloadDriveFile = async (fileId: string, token: string) => {
  const res = await axios.get<ArrayBuffer>(
    driveFileUrl(fileId, "alt=media&supportsAllDrives=true"),
    {
      headers: { Authorization: `Bearer ${token}` },
      responseType: "arraybuffer",
      maxContentLength: MAX_BYTES,
      validateStatus: () => true,
    },
  );
  if (res.status !== 200) {
    throw new Error("Couldn't download the PowerPoint from Google Drive.");
  }
  return Buffer.from(res.data);
};
