import { FileStore } from "@tus/file-store";
import { Server } from "@tus/server";
import express, { Express, static as staticMiddleware } from "express";
import multer from "multer";
import path from "path";
import { fromString, typeidUnboxed } from "typeid-js";

const storage = multer.diskStorage({
  destination: path.resolve(`${__dirname}/../../../uploads`),
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

// TODO: Setup caddy properly
// https://github.com/tus/tus-node-server/tree/main/packages/server#example-use-with-nginx
const server = new Server({
  path: "/media/upload/tus",
  datastore: new FileStore({
    directory: path.resolve(`${__dirname}/../../../uploads`),
  }),
  respectForwardedHeaders: true,
  onUploadCreate: (req, res, upload) => {
    // TODO: Authentication
    // TODO: Better validation
    if (
      !upload.metadata ||
      !("id" in upload.metadata) ||
      !("extension" in upload.metadata)
    ) {
      throw new Error("Invalid metadata");
    }

    // This works as validation since it will throw if invalid
    fromString(upload.metadata.id!, "media");

    return Promise.resolve(res);
  },
  namingFunction: (req, metadata) => {
    return `${metadata!.id}.${metadata!.extension}`;
  },
});
const tusUploadServer = express();
tusUploadServer.all("*", server.handle.bind(server));

export default (app: Express) => {
  app.use(
    `/media/data`,
    staticMiddleware(path.resolve(`${__dirname}/../../../uploads`)),
  );
  app.use("/media/upload/tus", tusUploadServer);
  app.use(`/media/upload/formData`, upload.single("file"), (req, res, next) => {
    // Shouldn't get here since we have multer
    if (!req.file) {
      res.status(500).send("Error");
      return;
    }
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
