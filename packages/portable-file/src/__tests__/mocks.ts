import { Readable } from "stream";

import { bufferToStream } from "../helper";
import { Media, Project } from "../types";

// Helper function to create a test project
export const createTestProject = (): Project => ({
  document: Buffer.from(
    JSON.stringify({ slides: [{ id: "1", content: "Test slide" }] }),
  ),
  name: "Test Project",
  targetDate: new Date("2024-12-25"),
  categoryName: "Test Category",
});

// Helper function to create a minimal test project
export const createMinimalTestProject = (): Project => ({
  document: Buffer.from(JSON.stringify({ slides: [] })),
  name: "Minimal Project",
  // targetDate and categoryName are undefined
});

// Helper function to create a large test project
export const createLargeTestProject = (): Project => {
  const largeDocument = {
    slides: Array.from({ length: 100 }, (_, i) => ({
      id: `slide-${i}`,
      content: `This is slide ${i} with some content`,
    })),
  };

  return {
    document: Buffer.from(JSON.stringify(largeDocument)),
    name: "Large Project",
    targetDate: new Date("2024-12-25"),
    categoryName: "Large Category",
  };
};

// Helper function to create test media
export const createTestMedia = (): Media[] => [
  {
    id: "media-1",
    media_name: "test-image.jpg",
    file_size: 1024,
    file_offset: 0,
    original_name: "original-image.jpg",
    file_extension: ".jpg",
  },
  {
    id: "media-2",
    media_name: "test-video.mp4",
    file_size: 2048,
    file_offset: 1024,
    original_name: "original-video.mp4",
    file_extension: ".mp4",
  },
];

// Helper function to create minimal test media
export const createMinimalTestMedia = (): Media[] => [
  {
    id: "minimal-media",
    media_name: "minimal.txt",
    file_offset: 0,
    // file_size, original_name, file_extension are undefined
  },
];

// Helper function to create test media streams
export const createTestMediaStreams = (): Map<string, Readable> => {
  const mediaStreams = new Map<string, Readable>();
  mediaStreams.set("media-1", bufferToStream(Buffer.from("fake image data")));
  mediaStreams.set("media-2", bufferToStream(Buffer.from("fake video data")));
  return mediaStreams;
};

// Helper function to create minimal test media streams
export const createMinimalTestMediaStreams = (): Map<string, Readable> => {
  const mediaStreams = new Map<string, Readable>();
  mediaStreams.set(
    "minimal-media",
    bufferToStream(Buffer.from("minimal content")),
  );
  return mediaStreams;
};

// Helper function to create a getMedia function from a media streams map
export const createGetMediaFunction = (mediaStreams: Map<string, Readable>) => {
  return (mediaId: string): Readable => {
    const stream = mediaStreams.get(mediaId);
    if (!stream) {
      throw new Error(`Media not found: ${mediaId}`);
    }
    return stream;
  };
};

// Helper function to create an empty getMedia function
export const createEmptyGetMediaFunction = (): ((
  mediaId: string,
) => Readable) => {
  return (): Readable => bufferToStream(Buffer.from(""));
};
