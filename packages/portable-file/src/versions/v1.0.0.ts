import archiver from "archiver";
import Database from "better-sqlite3";
import { PassThrough, Readable } from "stream";
import * as yauzl from "yauzl";

import { Media, Project } from "../types";
import { streamToBuffer } from "../helper";

const createTOPFile = async (data: {
  mediaRows: Media[];
  getMedia: (mediaId: string) => Readable;
  project: Project;
}): Promise<Readable> => {
  return new Promise((resolve, reject) => {
    // Create a PassThrough stream to collect the archive data
    const outputStream = new PassThrough();

    // Create the archive
    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    // Handle archive events
    archive.on("error", (err) => {
      reject(err);
    });

    archive.on("warning", (err) => {
      if (err.code === "ENOENT") {
        console.warn("Archive warning:", err);
      } else {
        reject(err);
      }
    });

    // Pipe archive data to the output stream
    archive.pipe(outputStream);

    // Start building the archive
    (async () => {
      try {
        // 1. Add version file
        archive.append("1.0.0", { name: "version" });

        // 2. Create SQLite database
        const db = new Database(":memory:");

        // Create tables
        db.exec(`
          CREATE TABLE projects (
            document BLOB,
            name TEXT NOT NULL,
            target_date TEXT,
            category_name TEXT
          );
        `);

        db.exec(`
          CREATE TABLE media (
            id TEXT PRIMARY KEY,
            media_name TEXT NOT NULL,
            file_size INTEGER,
            file_offset INTEGER NOT NULL,
            original_name TEXT,
            file_extension TEXT
          );
        `);

        // Insert project data
        const insertProject = db.prepare(`
          INSERT INTO projects (document, name, target_date, category_name)
          VALUES (?, ?, ?, ?)
        `);

        const documentBuffer = data.project.document;
        insertProject.run(
          documentBuffer,
          data.project.name,
          data.project.targetDate?.toISOString() || null,
          data.project.categoryName || null,
        );

        // Insert media data
        const insertMedia = db.prepare(`
          INSERT INTO media (id, media_name, file_size, file_offset, original_name, file_extension)
          VALUES (?, ?, ?, ?, ?, ?)
        `);

        for (const media of data.mediaRows) {
          insertMedia.run(
            media.id,
            media.media_name,
            media.file_size || null,
            media.file_offset,
            media.original_name || null,
            media.file_extension || null,
          );
        }

        // Export database and add to archive
        const dbBuffer = db.serialize();
        db.close();
        archive.append(dbBuffer, { name: "data.sqlite" });

        // 3. Add media files
        for (const media of data.mediaRows) {
          const mediaStream = data.getMedia(media.id);
          const mediaPath = `media/${media.id}${media.file_extension || ""}`;
          archive.append(mediaStream, { name: mediaPath });
        }

        // Finalize the archive
        await archive.finalize();

        // Resolve with the output stream
        resolve(outputStream);
      } catch (error) {
        reject(error);
      }
    })();
  });
};

const parseTOPFile = async (
  fileBuffer: Buffer,
): Promise<{
  version: string;
  project: Project;
  media: Media[];
  getMedia: (mediaId: string) => Promise<Readable>;
}> => {
  return new Promise((resolve, reject) => {
    yauzl.fromBuffer(fileBuffer, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        reject(err);
        return;
      }

      const entries = new Map<string, yauzl.Entry>();
      let version = "";
      let project: Project;
      let media: Media[] = [];

      zipfile.readEntry();

      zipfile.on("entry", (entry: yauzl.Entry) => {
        entries.set(entry.fileName, entry);

        if (entry.fileName === "version") {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              reject(err);
              return;
            }

            streamToBuffer(readStream!)
              .then((buffer) => {
                version = buffer.toString();
                zipfile.readEntry();
              })
              .catch(reject);
          });
        } else if (entry.fileName === "data.sqlite") {
          zipfile.openReadStream(entry, (err, readStream) => {
            if (err) {
              reject(err);
              return;
            }

            streamToBuffer(readStream!)
              .then((dbBuffer) => {
                const db = new Database(dbBuffer);

                // Get project data
                const projectRow = db
                  .prepare("SELECT * FROM projects LIMIT 1")
                  .get() as any;
                if (!projectRow) {
                  reject(new Error("No project data found in database"));
                  return;
                }

                project = {
                  document: Buffer.from(projectRow.document),
                  name: projectRow.name,
                  targetDate: projectRow.target_date
                    ? new Date(projectRow.target_date)
                    : undefined,
                  categoryName: projectRow.category_name || undefined,
                };

                // Get media data
                const mediaRows = db
                  .prepare("SELECT * FROM media")
                  .all() as any[];
                media = mediaRows.map((row) => ({
                  id: row.id,
                  media_name: row.media_name,
                  file_size: row.file_size || undefined,
                  file_offset: row.file_offset,
                  original_name: row.original_name || undefined,
                  file_extension: row.file_extension || undefined,
                }));

                db.close();
                zipfile.readEntry();
              })
              .catch(reject);
          });
        } else {
          zipfile.readEntry();
        }
      });

      zipfile.on("end", () => {
        const getMedia = async (mediaId: string): Promise<Readable> => {
          const mediaEntry = Array.from(entries.values()).find(
            (entry) =>
              entry.fileName.startsWith("media/") &&
              entry.fileName.includes(mediaId),
          );

          if (!mediaEntry) {
            throw new Error(`Media file not found: ${mediaId}`);
          }

          return new Promise((resolve, reject) => {
            zipfile.openReadStream(mediaEntry, (err, readStream) => {
              if (err) {
                reject(err);
                return;
              }
              resolve(readStream!);
            });
          });
        };

        resolve({
          version,
          project,
          media,
          getMedia,
        });
      });

      zipfile.on("error", reject);
    });
  });
};

export default { createTOPFile, parseTOPFile };
