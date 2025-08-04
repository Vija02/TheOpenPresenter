import { readFileSync, writeFileSync } from "fs";
import path from "path";

const twClassPath = path.resolve(
  import.meta.dirname,
  "./.tw-patch/tw-class-list.json",
);

const classList = JSON.parse(readFileSync(twClassPath).toString());

const newClassList = classList.concat(["stack-row", "stack-col", "center"]);

writeFileSync(twClassPath, JSON.stringify(newClassList, null, 2));
