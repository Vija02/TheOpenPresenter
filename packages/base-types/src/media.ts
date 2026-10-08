import type React from "react";

import type { InternalVideo } from "./video";

export type UUID = string;

export type PluginContext = {
  pluginId: UUID;
  sceneId: UUID;
  organizationId: UUID;
  projectId: UUID;
};

export type MediaType = "video" | "image" | "audio" | "pdf" | "ppt" | "all";

export type MediaPickerOptions = {
  type?: MediaType | MediaType[];
  title?: string;
  portalContainer?: HTMLElement | null;
  multiple?: boolean;
  autoPickVideo?: boolean;
  customComponent?: React.ReactNode;
  overrideAllowedFileTypes?: string[];
};

export type MediaPickerOptionsInternal = MediaPickerOptions & {
  pluginContext: PluginContext;
};

/** A library audio file, processed for playback */
export type InternalAudio = {
  /** Null until processing finishes */
  playbackMediaName: string | null;
  coverMediaName: string | null;
  metadata: {
    title?: string;
    artist?: string;
    album?: string;
    /** In seconds */
    duration?: number;
  };
};

export type MediaPickerResult = {
  id: string;
  mediaName: string;
  originalName: string | null;
  fileExtension: string | null;
  url: string;
  internalVideo?: InternalVideo;
  internalAudio?: InternalAudio;
  extraMeta?: {
    childThumbnailUrl?: string;
  };
};

export type MediaListOptions = {
  type?: MediaType | MediaType[];
  pluginContext: PluginContext;
};

export type MediaPicker = {
  show: (
    options: MediaPickerOptionsInternal,
  ) => Promise<MediaPickerResult[] | null>;
  close?: () => void;
  /** For custom UI */
  list?: (options: MediaListOptions) => Promise<MediaPickerResult[]>;
};
