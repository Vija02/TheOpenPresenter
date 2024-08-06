import { Express, static as staticMiddleware } from "express";
import multer from "multer";
import path from "path";
import { typeidUnboxed } from "typeid-js";

const storage = multer.diskStorage({
  destination: path.resolve(`${__dirname}/../../../../uploads`),
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
  app.use(
    `/media/data`,
    staticMiddleware(path.resolve(__dirname, "../../../../uploads")),
  );
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
