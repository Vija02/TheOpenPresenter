import { UPLOADS_PATH, createFileStore } from "@repo/backend-shared";
import { Server } from "@tus/server";
import express, { Express, static as staticMiddleware } from "express";
import http from "http";
import multer from "multer";
import { fromString, typeidUnboxed } from "typeid-js";

import { getAuthPgPool } from "./installDatabasePools";

const storage = multer.diskStorage({
  destination: UPLOADS_PATH,
  filename: function (_req, file, cb) {
    const originalFileName = file.originalname;
    const splitFileName = originalFileName.split(".") ?? [""];
    const extension = splitFileName[splitFileName.length - 1];

    const newFileName = typeidUnboxed("media") + "." + extension;

    cb(null, newFileName);
  },
});
const upload = multer({
  storage,
});

export default (app: Express) => {
  // TODO: Setup caddy properly
  // https://github.com/tus/tus-node-server/tree/main/packages/server#example-use-with-nginx
  const server = new Server({
    path: "/media/upload/tus",
    datastore: createFileStore(app),
    respectForwardedHeaders: true,
    onUploadCreate: async (req, res, upload) => {
      // TODO: Better Authentication & Validation (with file limit)

      if (
        !upload.metadata ||
        !("id" in upload.metadata) ||
        !("extension" in upload.metadata) ||
        !("organizationId" in upload.metadata)
      ) {
        throw new Error("Bad Request");
      }

      let userId;

      const authPgPool = getAuthPgPool(app);
      const client = await authPgPool.connect();
      try {
        await client.query("BEGIN");

        await client.query(
          `select set_config('role', $1::text, true), set_config('jwt.claims.session_id', $2::text, true)`,
          [
            process.env.DATABASE_VISITOR,
            (req as OurRequest)?.user?.session_id ?? "",
          ],
        );
        const {
          rows: [row],
        } = await client.query(
          "select * from app_public.organizations where id = $1",
          [upload.metadata.organizationId],
        );
        if (!row) {
          throw new Error("Not Authorized");
        }
        const {
          rows: [user],
        } = await client.query("select app_public.current_user_id() as id");
        userId = user.id;

        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        throw e;
      } finally {
        client.release();
      }

      // This works as validation since it will throw if invalid
      fromString(upload.metadata.id!, "media");

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

  app.use(`/media/data`, staticMiddleware(UPLOADS_PATH));
  app.use("/media/upload/tus", tusUploadServer);
  app.use(`/media/upload/form-data`, upload.single("file"), (req, res, next) => {
    // Shouldn't get here since we have multer
    if (!req.file) {
      res.status(500).send("Error");
      return;
    }
    // TODO: Permission

    const originalFileName = req.file.originalname;
    const newFileName = req.file.filename;

    const splitFileName = originalFileName.split(".") ?? [""];
    const extension = splitFileName[splitFileName.length - 1];

    res.status(200).json({
      originalFileName,
      newFileName,
      url: process.env.ROOT_URL + "/media/data/" + newFileName,
      extension,
    });
  });
};

interface OurRequest extends http.IncomingMessage {
  user: { session_id: string };
}
