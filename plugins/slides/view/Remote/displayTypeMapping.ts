import { DisplayMode, ImportType } from "../../src/types";

export const displayTypeMapping = {
  googleslides: ["googleslides"],
  image: ["googleslides", "pdf", "ppt"],
} as Record<DisplayMode, ImportType[]>;
