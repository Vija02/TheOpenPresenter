import { DisplayMode, ImportType } from "../../src/types";

export const displayTypeMapping = {
  googleslides: ["googleslides"],
  powerpoint: ["ppt"],
  image: ["googleslides", "canva", "pdf", "ppt", "image"],
  layout: ["custom"],
} as Record<DisplayMode, ImportType[]>;
