import { DisplayMode, ImportType } from "../../src/types";

export const displayTypeMapping = {
  googleslides: ["googleslides"],
  image: ["googleslides", "pdf", "ppt", "image"],
} as Record<DisplayMode, ImportType[]>;
