import { media } from "@repo/backend-shared";
import { Server } from "@tus/server";
import express, { Express, static as staticMiddleware } from "express";
import http from "http";
import multer from "multer";
import { fromString } from "typeid-js";

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
  // TODO: Setup caddy properly
  // https://github.com/tus/tus-node-server/tree/main/packages/server#example-use-with-nginx
  const server = new Server({
    path: "/media/upload/tus",
    datastore: media.file.createTusStore(app),
    respectForwardedHeaders: true,
    onUploadCreate: async (req, res, upload) => {
      // TODO: Better Validation (with file limit)

      if (
        !upload.metadata ||
        !("id" in upload.metadata) ||
        !("extension" in upload.metadata) ||
        !("organizationId" in upload.metadata)
      ) {
        throw new Error("Bad Request");
      }

      // This works as validation since it will throw if invalid
      fromString(upload.metadata.id!, "media");

      const userId = await checkUserAuth(app, {
        organizationId: upload.metadata.organizationId ?? "",
        sessionId: (req as OurRequest)?.user?.session_id ?? "",
      });

      return Promise.resolve({
        res,
        metadata: {
          id: upload.metadata.id,
          extension: upload.metadata.extension,
          originalFileName: null,
          organizationId: upload.metadata.organizationId,
          userId: userId,
        },
      });
    },
    namingFunction: (req, metadata) => {
      return `${metadata!.id}.${metadata!.extension}`;
    },
  });
  const tusUploadServer = express();
  tusUploadServer.all("*", server.handle.bind(server));

  const upload = multer({
    storage: new media.file.multerStorage(app),
  });

  app.use(`/media/data`, staticMiddleware(media.UPLOADS_PATH));
  app.use("/media/upload/tus", tusUploadServer);
  app.use(
    `/media/upload/form-data`,
    async (reqRaw, res, next) => {
      const req = reqRaw as media.OurMulterRequest;

      if (!req.headers["organization-id"]) {
        res.status(400).send("Missing organization-id");
        return;
      }
      req.customMulterData = {
        organizationId: req.headers["organization-id"].toString(),
      };

      const userId = await checkUserAuth(app, {
        organizationId: req.customMulterData.organizationId ?? "",
        sessionId: (req as OurRequest)?.user?.session_id ?? "",
      });
      req.customMulterData.userId = userId;

      next();
    },
    // Handle the upload
    upload.single("file"),
    async (req, res) => {
      const splitFileName = req.file?.originalname.split(".") ?? [""];
      const extension = splitFileName[splitFileName.length - 1];

      res.status(200).json({
        originalFileName: req.file?.originalname,
        newFileName: req.file?.filename,
        url: process.env.ROOT_URL + "/media/data/" + req.file?.filename,
        extension,
      });
    },
  );
};

interface OurRequest extends http.IncomingMessage {
  user: { session_id: string };
}
