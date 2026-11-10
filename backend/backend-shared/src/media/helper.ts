import { OurMulterRequest } from "./types";

export const extractFileExtension = ({
  originalFileName,
  explicitFileExtension,
}: {
  originalFileName?: string;
  explicitFileExtension?: string;
}) => {
  let fileExtension;
  if (explicitFileExtension) {
    fileExtension = explicitFileExtension;
  } else if (originalFileName) {
    const splittedKey = originalFileName.split(".");
    if (splittedKey.length <= 1) {
      fileExtension = "";
    }
    fileExtension = splittedKey[splittedKey.length - 1]!;
  } else {
    fileExtension = "";
  }

  return fileExtension;
};

export const multerProcessFileName = (
  file: Express.Multer.File,
  customMulterData: OurMulterRequest["customMulterData"],
) => {
  const fileExtension = extractFileExtension({
    explicitFileExtension: customMulterData?.explicitFileExtension,
    originalFileName: file.originalname,
  });

  return { fileExtension };
};

/**
 * Whether sharp can be used in this process. Under Electron on Linux it
 * crashes the whole process on its first image: Electron loads the system
 * GLib and sharp's libvips brings its own, and the two clash. The studio runs
 * its local server on Electron, so there images are served as they are.
 */
export const canProcessImages = (): boolean =>
  !(process.versions.electron && process.platform === "linux");
