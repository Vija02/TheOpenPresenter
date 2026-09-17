import { elementLabel } from "../../doc/edit";
import { HostElement } from "../../schema/element";

/** Shown when nothing renders on it */
export const HostElementPlaceholder = ({
  element,
}: {
  element: HostElement;
}) => (
  <div
    aria-hidden
    style={{
      position: "absolute",
      inset: 0,
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      overflow: "hidden",
      borderRadius: "inherit",
      border: "1px dashed rgba(148, 163, 184, 0.9)",
      backgroundImage:
        "repeating-linear-gradient(45deg, rgba(148,163,184,0.16) 0 6px, rgba(148,163,184,0) 6px 12px)",
    }}
  >
    <span
      style={{
        padding: "2px 6px",
        borderRadius: 4,
        maxWidth: "90%",
        overflow: "hidden",
        textOverflow: "ellipsis",
        whiteSpace: "nowrap",
        fontSize: 11,
        lineHeight: 1.3,
        fontWeight: 500,
        color: "rgba(226, 232, 240, 0.95)",
        background: "rgba(15, 23, 42, 0.65)",
      }}
    >
      {elementLabel(element)}
    </span>
  </div>
);
