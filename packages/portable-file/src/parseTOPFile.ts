import { Readable } from "stream";
import * as yauzl from "yauzl";

import { streamToBuffer } from "./helper";
import { Media, Project } from "./types";
import v1_0_0 from "./versions/v1.0.0";

// Helper function to read version
const readVersionFromZip = async (fileBuffer: Buffer): Promise<string> => {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(fileBuffer, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        reject(err);
        return;
      }

      zipfile.readEntry();

      zipfile.on("entry", (entry: yauzl.Entry) => {
        if (entry.fileName === "version") {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              reject(err);
              return;
            }

            streamToBuffer(readStream!)
              .then((buffer) => {
                const version = buffer.toString().trim();
                zipfile.close();
                resolve(version);
              })
              .catch(reject);
          });
        } else {
          zipfile.readEntry();
        }
      });

      zipfile.on("end", () => {
        reject(new Error("Version file not found in archive"));
      });

      zipfile.on("error", reject);
    });
  });
};

export const parseTOPFile = async (
  file: Readable,
): Promise<{
  version: string;
  project: Project;
  media: Media[];
  getMedia: (mediaId: string) => Promise<Readable>;
}> => {
  // Convert file to buffer here
  const fileBuffer = await streamToBuffer(file);

  const version = await readVersionFromZip(fileBuffer);

  switch (version) {
    case "1.0.0":
      return await v1_0_0.parseTOPFile(fileBuffer);

    // Future versions can be added here:
    // case "1.1.0":
    //   return await v1_1_0.parseTOPFile(fileStream);
    // case "2.0.0":
    //   return await v2_0_0.parseTOPFile(fileStream);

    default:
      throw new Error(`Unsupported file version: ${version}`);
  }
};
