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
