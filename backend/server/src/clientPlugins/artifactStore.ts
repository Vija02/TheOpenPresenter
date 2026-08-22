import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import fs from "node:fs";
import fsp from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";

const PREFIX = "cplugin";

export const artifactKey = (versionId: string, filename: string) =>
  `${PREFIX}/${versionId}/${filename}`;

// DEBT: We re-implement the store for each type here
// This is because our previous implementation is very interconnected with the media table
// It's probably easier to update it if we ever add another store compared to abstracting it
export interface ArtifactStore {
  put(
    key: string,
    content: string | Buffer,
    contentType: string,
  ): Promise<void>;
  getStream(
    key: string,
  ): Promise<{ stream: Readable; contentType?: string } | null>;
}

class S3ArtifactStore implements ArtifactStore {
  private client: S3Client;
  private bucket: string;

  constructor() {
    this.bucket = process.env.STORAGE_S3_BUCKET!;
    this.client = new S3Client({
      region: process.env.STORAGE_S3_REGION,
      endpoint: process.env.STORAGE_S3_ENDPOINT,
      credentials: {
        accessKeyId: process.env.STORAGE_S3_ACCESS_KEY_ID!,
        secretAccessKey: process.env.STORAGE_S3_SECRET_ACCESS_KEY!,
      },
      forcePathStyle: true,
      requestChecksumCalculation: "WHEN_REQUIRED",
      responseChecksumValidation: "WHEN_REQUIRED",
    });
  }

  async put(key: string, content: string | Buffer, contentType: string) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.bucket,
        Key: key,
        Body: content,
        ContentType: contentType,
        CacheControl: "public, max-age=31536000, immutable",
      }),
    );
  }

  async getStream(key: string) {
    try {
      const res = await this.client.send(
        new GetObjectCommand({ Bucket: this.bucket, Key: key }),
      );
      if (!res.Body) return null;
      return {
        stream: res.Body as Readable,
        contentType: res.ContentType,
      };
    } catch (err: any) {
      if (err?.name === "NoSuchKey" || err?.$metadata?.httpStatusCode === 404) {
        return null;
      }
      throw err;
    }
  }
}

class FileArtifactStore implements ArtifactStore {
  private root: string;

  constructor() {
    this.root =
      process.env.CLIENT_PLUGIN_ARTIFACTS_PATH ??
      process.env.UPLOADS_PATH ??
      path.resolve(__dirname, "../../uploads");
  }

  private resolve(key: string) {
    // Guard against path traversal.
    const safe = path.normalize(key).replace(/^(\.\.(\/|\\|$))+/, "");
    return path.join(this.root, safe);
  }

  async put(key: string, content: string | Buffer, _contentType: string) {
    const filePath = this.resolve(key);
    await fsp.mkdir(path.dirname(filePath), { recursive: true });
    await fsp.writeFile(filePath, content);
  }

  async getStream(key: string) {
    const filePath = this.resolve(key);
    try {
      await fsp.access(filePath);
    } catch {
      return null;
    }
    return { stream: fs.createReadStream(filePath), contentType: undefined };
  }
}

let store: ArtifactStore | null = null;

export const getArtifactStore = (): ArtifactStore => {
  if (store) return store;
  store =
    process.env.STORAGE_TYPE === "s3"
      ? new S3ArtifactStore()
      : new FileArtifactStore();
  return store;
};
