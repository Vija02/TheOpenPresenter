import { Express, static as staticMiddleware } from "express";
import path from "path";

export default (app: Express) => {
  app.use(
    staticMiddleware(path.resolve(__dirname, "../public"), {
      maxAge: "1y",
      immutable: true,
    }),
  );
};
