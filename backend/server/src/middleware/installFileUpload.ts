import { media } from "@repo/backend-shared";
import {
  ALLOWED_IMAGE_WIDTH,
  constructMediaName,
  extractMediaName,
  mediaIdFromUUID,
  streamToBuffer,
  uuidFromMediaId,
} from "@repo/lib";
import { logger } from "@repo/observability";
import { Server } from "@tus/server";
import express, { Express, static as staticMiddleware } from "express";
import fs from "fs";
import http from "http";
import { createProxyMiddleware } from "http-proxy-middleware";
import multer from "multer";
import os from "os";
import { Pool } from "pg";
import sharp from "sharp";
import { Readable } from "stream";
import { pipeline } from "stream/promises";
import { TypeId, fromString, toUUID, typeidUnboxed } from "typeid-js";

import { getAuthPgPool, getRootPgPool } from "./installDatabasePools";

// TODO: File size validation & increase caddy max_size
export default (app: Express) => {
  // Handle serving the media
  if (process.env.STORAGE_PROXY) {
    if (
      process.env.STORAGE_PROXY === "local" &&
      process.env.STORAGE_TYPE === "file"
    ) {
      app.use(`/media/data`, staticMiddleware(media.UPLOADS_PATH));
    } else if (isValidURL(process.env.STORAGE_PROXY)) {
      const apiProxy = createProxyMiddleware({
        target: process.env.STORAGE_PROXY,
        changeOrigin: true,
      });
      app.use(`/media/data`, apiProxy);
    }
  }

  app.use(`/media/processed/:width/:mediaName`, async (req, res) => {
    const width = parseInt(req.params.width, 10);

    // Validate
    if (!ALLOWED_IMAGE_WIDTH.includes(width)) {
      res.status(400).send("Invalid image width");
      return;
    }

    let mediaDetails: ReturnType<typeof extractMediaName>;

    try {
      mediaDetails = extractMediaName(req.params.mediaName);
    } catch (e) {
      res.status(400).send("Invalid media name");
      return;
    }

    // TODO: extension
    if (!["jpg", "png", "webp"].includes(mediaDetails.extension)) {
      res.status(400).send();
      return;
    }

    const rootPgPool = getRootPgPool(app);
    const mediaHandler = new media[
      process.env.STORAGE_TYPE as "file" | "s3"
    ].mediaHandler(rootPgPool);

    // If processed file exist, redirect to data URL
    try {
      const {
        rows: [row],
      } = await rootPgPool.query(
        `SELECT processed_media_id FROM app_public.media_image_sizes
        WHERE 
        image_media_id = $1 AND 
        width = $2 AND 
        file_type = $3
        `,
        [mediaDetails.uuid, width, mediaDetails.extension],
      );
      res.redirect(
        301,
        `/media/data/${constructMediaName(mediaIdFromUUID(row.processed_media_id), mediaDetails.extension)}`,
      );

      return;
    } catch (e) {}

    // If doesn't exist, then we do something
    try {
      // Get the metadata first
      const {
        rows: [mediaRow],
      } = await rootPgPool.query(
        `select m.*, mim.width, mim.height from app_public.medias m left join app_public.media_image_metadata mim on m.id = mim.image_media_id where m.id = $1`,
        [mediaDetails.uuid],
      );

      // If requested size is bigger than original file, skip the resize and just give the original file
      if (mediaRow.width && width > mediaRow.width) {
        res.redirect(301, `/media/data/${req.params.mediaName}`);
        return;
      }

      let rawData = await mediaHandler.store.read(req.params.mediaName);

      // If image metadata doesn't exist, let's process that and store it to the db
      if (mediaRow.width === null || mediaRow.height === null) {
        logger.warn(
          { mediaId: mediaRow.id },
          "/media/processed endpoint: width or height not available on image. This should only happen on old data",
        );
        // Store in buffer as we consume, so that we can reuse it later
        const bufferPromise = streamToBuffer(rawData);
        const metadata = await new Promise<sharp.Metadata>(
          (resolve, reject) => {
            pipeline(
              rawData,
              sharp().metadata((err, metadata) => {
                if (err) reject(err);
                resolve(metadata);
              }),
            );
          },
        );
        const buffer = await bufferPromise;
        // Restore the stream to be used later on
        rawData = Readable.from(buffer);

        await rootPgPool.query(
          `INSERT INTO app_public.media_image_metadata (image_media_id, width, height)
            VALUES ($1, $2, $3) ON CONFLICT (image_media_id) DO UPDATE 
            SET 
              width = $2,
              height = $3
          `,
          [mediaDetails.uuid, metadata.width, metadata.height],
        );

        // Again, if requested size is bigger than original file, skip the resize and just give the original file
        if (metadata.width && width > metadata.width) {
          res.redirect(301, `/media/data/${req.params.mediaName}`);
          return;
        }
      }

      const processedMediaId = typeidUnboxed("media");

      const tempFilePath = os.tmpdir() + `/${processedMediaId}`;
      // Convert
      await pipeline(
        rawData,
        sharp().rotate().resize(width).withMetadata(),
        fs.createWriteStream(tempFilePath),
      );

      // Upload to media
      await mediaHandler.uploadMedia({
        file: fs.createReadStream(tempFilePath),
        userId: mediaRow.user_id,
        organizationId: mediaRow.organization_id,
        isUserUploaded: false,
        fileSize: fs.statSync(tempFilePath).size,
        fileExtension: mediaDetails.extension,
        mediaId: processedMediaId,
      });

      // Add the record to DB
      await rootPgPool.query(
        `INSERT INTO app_public.media_image_sizes (image_media_id, processed_media_id, width, file_type)
          VALUES ($1, $2, $3, $4)
          `,
        [
          mediaDetails.uuid,
          uuidFromMediaId(processedMediaId),
          width,
          mediaDetails.extension,
        ],
      );

      // Create the dependency
      await mediaHandler.createDependency(
        mediaDetails.uuid,
        uuidFromMediaId(processedMediaId),
      );

      fs.rmSync(tempFilePath);

      res.redirect(
        301,
        `/media/data/${constructMediaName(processedMediaId, mediaDetails.extension)}`,
      );
    } catch (error) {
      console.error(error);
      logger.error(
        { error },
        "/media/processed endpoint: width or height not available on image. This should only happen on old data",
      );
      res.status(500).send("Error when processing image");
      return;
    }
  });

  // ================================== //
  // =========== Tus Upload =========== //
  // ================================== //
  const server = new Server({
    path: "/media/upload/tus",
    datastore: media[process.env.STORAGE_TYPE as "file" | "s3"].createTusStore(
      getRootPgPool(app),
    ),
    respectForwardedHeaders: true,
    onUploadCreate: async (req, res, upload) => {
      if (!req.headers["organization-id"]) {
        throw new Error("Missing organization-id header");
      }

      const organizationId = req.headers["organization-id"].toString();

      try {
        const userId = await checkUserAuth(app, {
          organizationId: organizationId,
          sessionId: (req as OurRequest)?.user?.session_id ?? "",
        });
        return Promise.resolve({
          res,
          metadata: {
            originalFileName: upload.metadata?.filename ?? null,
            organizationId,
            userId,
          },
        });
      } catch (e) {
        throw new Error("You are not allowed to do this action.");
      }
    },
    namingFunction: (req, metadata) => {
      const fileExtension = media.extractFileExtension({
        explicitFileExtension: req.headers["file-extension"]?.toString(),
        originalFileName: metadata?.filename?.toString(),
      });

      let mediaId: string = typeidUnboxed("media");
      if (req.headers["custom-media-id"]) {
        mediaId = req.headers["custom-media-id"].toString();
        try {
          // This works as validation since it will throw if invalid
          fromString(mediaId, "media");
        } catch (e) {
          throw new Error("Invalid custom-media-id");
        }
      }

      return `${mediaId}.${fileExtension}`;
    },
    onUploadFinish: async (_req, res, upload) => {
      const splittedKey = upload.id.split(".");
      const mediaId = splittedKey[0];
      const uuid = toUUID(mediaId as TypeId<string>);

      const rootPgPool = app.get("rootPgPool") as Pool;
      await rootPgPool.query(
        `UPDATE app_public.medias
          SET 
            is_complete = $1
          WHERE id = $2
        `,
        [true, uuid],
      );

      return res;
    },
  });
  const tusUploadServer = express();
  tusUploadServer.all("*", server.handle.bind(server));

  app.use("/media/upload/tus", tusUploadServer);

  // ================================== //
  // ==== Form Data / Multer Upload === //
  // ================================== //
  const upload = multer({
    storage: new media[process.env.STORAGE_TYPE as "file" | "s3"].multerStorage(
      getRootPgPool(app),
    ),
  });

  app.use(
    `/media/upload/form-data`,
    async (reqRaw, res, next) => {
      const req = reqRaw as media.OurMulterRequest;

      if (!req.headers["organization-id"]) {
        res.status(400).send("Missing organization-id header");
        return;
      }
      if (!req.headers["upload-length"]) {
        res.status(400).send("Missing upload-length header");
        return;
      }

      const uploadLength = parseInt(
        req.headers["upload-length"].toString(),
        10,
      );
      if (!Number.isSafeInteger(uploadLength)) {
        res.status(400).send("Invalid upload-length");
        return;
      }

      req.customMulterData = {
        organizationId: req.headers["organization-id"].toString(),
        uploadLength,
        explicitFileExtension: req.headers["file-extension"]
          ? req.headers["file-extension"].toString()
          : undefined,
      };

      let mediaId: string = typeidUnboxed("media");
      if (req.headers["custom-media-id"]) {
        mediaId = req.headers["custom-media-id"].toString();
        try {
          // This works as validation since it will throw if invalid
          fromString(mediaId, "media");
        } catch (e) {
          res.status(400).send("Invalid custom-media-id");
        }
      }
      req.customMulterData.mediaId = mediaId;

      try {
        const userId = await checkUserAuth(app, {
          organizationId: req.customMulterData.organizationId ?? "",
          sessionId: (req as OurRequest)?.user?.session_id ?? "",
        });
        req.customMulterData.userId = userId;
      } catch (e) {
        res.status(403).send("You are not allowed to do this action.");
        return;
      }

      next();
    },
    // Handle the upload
    upload.single("file"),
    async (reqRaw, res) => {
      const req = reqRaw as media.OurMulterRequest;

      const { fileExtension } = media.multerProcessFileName(
        req.file as Express.Multer.File,
        req.customMulterData,
      );

      res.status(200).json({
        mediaId: req.customMulterData?.mediaId,
        fileExtension,
        fileName: req.file?.filename,
        originalFileName: req.file?.originalname,
        url: process.env.ROOT_URL + "/media/data/" + req.file?.filename,
      });
    },
  );
};

function isValidURL(string: string) {
  try {
    new URL(string);
    return true;
  } catch {
    return false;
  }
}

const checkUserAuth = async (
  app: Express,
  { organizationId, sessionId }: { organizationId: string; sessionId: string },
) => {
  const authPgPool = getAuthPgPool(app);
  const client = await authPgPool.connect();
  try {
    await client.query("BEGIN");

    await client.query(
      `select set_config('role', $1::text, true), set_config('jwt.claims.session_id', $2::text, true)`,
      [process.env.DATABASE_VISITOR, sessionId],
    );
    const {
      rows: [row],
    } = await client.query(
      "select * from app_public.organizations where id = $1",
      [organizationId],
    );
    if (!row) {
      throw new Error("Not Authorized");
    }
    const {
      rows: [user],
    } = await client.query("select app_public.current_user_id() as id");

    return user.id;
  } catch (e) {
    throw e;
  } finally {
    client.release();
  }
};

interface OurRequest extends http.IncomingMessage {
  user: { session_id: string };
}
