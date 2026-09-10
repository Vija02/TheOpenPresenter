import { SUPPORTED_IMAGE_EXTENSIONS } from "@repo/lib";

export type SlideFileKind = "image" | "pdf" | "ppt";

export const PPT_EXTENSIONS = [".ppt", ".pptx"] as const;

export const classifySlideFile = (mediaName: string): SlideFileKind | null => {
  const rawExtension = mediaName.split(".").pop()?.toLowerCase() ?? "";
  const extension = `.${rawExtension}`;

  if (SUPPORTED_IMAGE_EXTENSIONS.includes(extension as any)) return "image";
  if (extension === ".pdf") return "pdf";
  if (PPT_EXTENSIONS.includes(extension as (typeof PPT_EXTENSIONS)[number])) {
    return "ppt";
  }

  return null;
};
