import { Readable } from "stream";

import { streamToBuffer } from "../../helper";
import { Media } from "../../types";
import v1_0_0 from "../v1.0.0";
import {
  createTestProject,
  createTestMedia,
  createTestMediaStreams,
  createGetMediaFunction,
  createMinimalTestProject,
  createMinimalTestMedia,
  createMinimalTestMediaStreams,
  createEmptyGetMediaFunction,
} from "../../__tests__/mocks";

const { createTOPFile, parseTOPFile } = v1_0_0;

describe("v1.0.0 TOP file operations", () => {
  it("creates a TOP file with all components", async () => {
    const project = createTestProject();
    const mediaRows = createTestMedia();
    const mediaStreams = createTestMediaStreams();

    const getMedia = createGetMediaFunction(mediaStreams);

    const topFile = await createTOPFile({
      mediaRows,
      getMedia,
      project,
    });

    expect(topFile).toBeInstanceOf(Readable);
    const topBuffer = await streamToBuffer(topFile);
    expect(topBuffer.length).toBeGreaterThan(0);
  });

  it("parses a TOP file and returns correct structure", async () => {
    const project = createTestProject();
    const mediaRows = createTestMedia();
    const mediaStreams = createTestMediaStreams();

    const getMedia = createGetMediaFunction(mediaStreams);

    // Create TOP file
    const topFile = await createTOPFile({
      mediaRows,
      getMedia,
      project,
    });

    // Parse TOP file - convert stream to buffer first
    const topBuffer = await streamToBuffer(topFile);
    const parsed = await parseTOPFile(topBuffer);

    expect(parsed.version).toBe("1.0.0");
    expect(parsed.project.name).toBe("Test Project");
    expect(parsed.project.categoryName).toBe("Test Category");
    expect(parsed.project.targetDate).toEqual(new Date("2024-12-25"));
    expect(parsed.project.document).toBeInstanceOf(Buffer);
    expect(parsed.media).toHaveLength(2);
    expect(parsed.getMedia).toBeInstanceOf(Function);
  });

  it("preserves project document data", async () => {
    const project = createTestProject();
    const mediaRows = createTestMedia();
    const mediaStreams = createTestMediaStreams();

    const getMedia = createGetMediaFunction(mediaStreams);

    // Create and parse TOP file
    const topFile = await createTOPFile({
      mediaRows,
      getMedia,
      project,
    });

    const topBuffer = await streamToBuffer(topFile);
    const parsed = await parseTOPFile(topBuffer);

    // Check document content
    const originalDocumentText = project.document.toString();
    const parsedDocumentText = parsed.project.document.toString();

    expect(parsedDocumentText).toBe(originalDocumentText);
  });

  it("handles project with optional fields missing", async () => {
    const project = createMinimalTestProject();
    const mediaRows: Media[] = [];
    const getMedia = createEmptyGetMediaFunction();

    const topFile = await createTOPFile({
      mediaRows,
      getMedia,
      project,
    });

    const topBuffer = await streamToBuffer(topFile);
    const parsed = await parseTOPFile(topBuffer);

    expect(parsed.project.name).toBe("Minimal Project");
    expect(parsed.project.targetDate).toBeUndefined();
    expect(parsed.project.categoryName).toBeUndefined();
    expect(parsed.media).toHaveLength(0);
  });

  it("handles media with optional fields missing", async () => {
    const project = createTestProject();
    const mediaRows = createMinimalTestMedia();
    const mediaStreams = createMinimalTestMediaStreams();
    const getMedia = createGetMediaFunction(mediaStreams);

    const topFile = await createTOPFile({
      mediaRows,
      getMedia,
      project,
    });

    const topBuffer = await streamToBuffer(topFile);
    const parsed = await parseTOPFile(topBuffer);

    expect(parsed.media).toHaveLength(1);
    const media = parsed.media[0];
    expect(media).toBeDefined();
    expect(media!.id).toBe("minimal-media");
    expect(media!.media_name).toBe("minimal.txt");
    expect(media!.file_offset).toBe(0);
    expect(media!.file_size).toBeUndefined();
    expect(media!.original_name).toBeUndefined();
    expect(media!.file_extension).toBeUndefined();
  });
});
