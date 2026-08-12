import { DisplayMode, ImportType } from "../../src/types";

export const displayTypeMapping = {
  googleslides: ["googleslides"],
  image: ["googleslides", "canva", "pdf", "ppt", "image"],
} as Record<DisplayMode, ImportType[]>;
