import { Readable } from "stream";

import { Media, Project } from "./types";
import v1_0_0 from "./versions/v1.0.0";

export const createTOPFile = async (data: {
  mediaRows: Media[];
  getMedia: (mediaId: string) => Readable;
  project: Project;
}): Promise<Readable> => {
  // Use the latest version
  return await v1_0_0.createTOPFile(data);
};
