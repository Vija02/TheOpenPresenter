import { media } from "@repo/backend-shared";
import { Server } from "@tus/server";
import express, { Express, static as staticMiddleware } from "express";
import http from "http";
import { createProxyMiddleware } from "http-proxy-middleware";
import multer from "multer";
import { Pool } from "pg";
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
