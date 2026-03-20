// ============================================================================
// Helper functions for checking file types by extension
// ============================================================================
import {
  BROWSER_SUPPORTED_AUDIO_EXTENSIONS,
  BROWSER_SUPPORTED_IMAGE_EXTENSIONS,
  BROWSER_SUPPORTED_VIDEO_EXTENSIONS,
  HLS_EXTENSIONS,
  SUPPORTED_AUDIO_EXTENSIONS,
  SUPPORTED_IMAGE_EXTENSIONS,
  SUPPORTED_VIDEO_EXTENSIONS,
} from "./constants";

export const normalizeExtension = (
  extension: string | null | undefined,
): string => {
  if (!extension) return "";
  const ext = extension.startsWith(".") ? extension : `.${extension}`;
  return ext.toLowerCase();
};

export const isExtensionInList = (
  extension: string | null | undefined,
  list: readonly string[],
): boolean => {
  const ext = normalizeExtension(extension);
  return ext !== "" && list.includes(ext);
};

// ============================================================================
// File type detection functions (all supported formats)
// ============================================================================

export const isImageFile = (extension: string | null | undefined): boolean =>
  isExtensionInList(extension, SUPPORTED_IMAGE_EXTENSIONS);
export const isVideoFile = (extension: string | null | undefined): boolean =>
  isExtensionInList(extension, SUPPORTED_VIDEO_EXTENSIONS);
export const isAudioFile = (extension: string | null | undefined): boolean =>
  isExtensionInList(extension, SUPPORTED_AUDIO_EXTENSIONS);
export const isHlsFile = (extension: string | null | undefined): boolean =>
  isExtensionInList(extension, HLS_EXTENSIONS);

// ============================================================================
// Browser-supported file type detection functions
// ============================================================================

export const isBrowserSupportedImageFile = (
  extension: string | null | undefined,
): boolean => isExtensionInList(extension, BROWSER_SUPPORTED_IMAGE_EXTENSIONS);
export const isBrowserSupportedVideoFile = (
  extension: string | null | undefined,
): boolean => isExtensionInList(extension, BROWSER_SUPPORTED_VIDEO_EXTENSIONS);
export const isBrowserSupportedAudioFile = (
  extension: string | null | undefined,
): boolean => isExtensionInList(extension, BROWSER_SUPPORTED_AUDIO_EXTENSIONS);
