/**
 * What the Google Picker offers. PowerPoint files in Drive can't be read
 * through the Slides embed, so they are downloaded and go through the
 * PowerPoint import instead.
 */
export const GOOGLE_SLIDES_MIME_TYPE =
  "application/vnd.google-apps.presentation";

export const POWERPOINT_EXTENSION_BY_MIME: Record<string, "pptx" | "ppt"> = {
  "application/vnd.openxmlformats-officedocument.presentationml.presentation":
    "pptx",
  "application/vnd.ms-powerpoint": "ppt",
};

/** Comma-separated, as the Picker takes it */
export const PICKER_PRESENTATION_MIME_TYPES = [
  GOOGLE_SLIDES_MIME_TYPE,
  ...Object.keys(POWERPOINT_EXTENSION_BY_MIME),
].join(",");
