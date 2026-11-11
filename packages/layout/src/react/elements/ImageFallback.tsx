import { LuImageOff } from "react-icons/lu";

/** Shown in place of an image that couldn't be loaded. */
export const ImageFallback = () => (
  <div
    data-testid="image-fallback"
    style={{
      width: "100%",
      height: "100%",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "rgba(0, 0, 0, 0.35)",
      color: "rgba(255, 255, 255, 0.4)",
    }}
  >
    <LuImageOff size="20%" />
  </div>
);
