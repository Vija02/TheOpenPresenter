import { media } from "@repo/backend-shared";
import { Server } from "@tus/server";
import express, { Express, static as staticMiddleware } from "express";
import http from "http";
import multer from "multer";
import { fromString, typeidUnboxed } from "typeid-js";

import { getAuthPgPool } from "./installDatabasePools";

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

export default (app: Express) => {
  // TODO: File size validation
  // TODO: Setup caddy properly
  // https://github.com/tus/tus-node-server/tree/main/packages/server#example-use-with-nginx
  const server = new Server({
    path: "/media/upload/tus",
    datastore:
      media[process.env.STORAGE_TYPE as "file" | "s3"].createTusStore(app),
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
  });
  const tusUploadServer = express();
  tusUploadServer.all("*", server.handle.bind(server));

  const upload = multer({
    storage: new media[process.env.STORAGE_TYPE as "file" | "s3"].multerStorage(
      app,
    ),
  });

  app.use(`/media/data`, staticMiddleware(media.UPLOADS_PATH));
  app.use("/media/upload/tus", tusUploadServer);
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

interface OurRequest extends http.IncomingMessage {
  user: { session_id: string };
}
