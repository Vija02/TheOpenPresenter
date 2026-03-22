import { CSSProperties } from "react";

// Modal backdrop styles
export const modalBackdropStyle: CSSProperties = {
  position: "fixed",
  top: 0,
  left: 0,
  right: 0,
  bottom: 0,
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  zIndex: 9999,
};

// Modal container styles
export const modalContainerStyle: CSSProperties = {
  backgroundColor: "white",
  borderRadius: "8px",
  width: "90%",
  maxWidth: "800px",
  maxHeight: "80vh",
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

// Modal header styles
export const modalHeaderStyle: CSSProperties = {
  padding: "16px 20px",
  borderBottom: "1px solid #e5e7eb",
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
};

export const modalTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: "18px",
  fontWeight: 600,
};

export const closeButtonStyle: CSSProperties = {
  background: "none",
  border: "none",
  fontSize: "24px",
  cursor: "pointer",
  padding: "4px",
  lineHeight: 1,
};

// Modal content styles
export const modalContentStyle: CSSProperties = {
  padding: "16px",
  overflowY: "auto",
  flex: 1,
};

export const loadingStyle: CSSProperties = {
  textAlign: "center",
  padding: "40px",
};

export const emptyStateStyle: CSSProperties = {
  textAlign: "center",
  padding: "40px",
  color: "#666",
};

export const mediaGridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
  gap: "12px",
};

// Modal footer styles
export const modalFooterStyle: CSSProperties = {
  padding: "12px 20px",
  borderTop: "1px solid #e5e7eb",
  display: "flex",
  justifyContent: "flex-end",
};

export const cancelButtonStyle: CSSProperties = {
  padding: "8px 16px",
  backgroundColor: "#f3f4f6",
  border: "1px solid #d1d5db",
  borderRadius: "6px",
  cursor: "pointer",
  fontSize: "14px",
};

// MediaCard styles
export const getMediaCardStyle = (
  isHovered: boolean,
  disabled: boolean,
): CSSProperties => ({
  border:
    isHovered && !disabled
      ? "1px solid var(--accent)"
      : "1px solid var(--stroke)",
  borderRadius: "6px",
  overflow: "hidden",
  cursor: disabled ? "not-allowed" : "pointer",
  backgroundColor:
    isHovered && !disabled
      ? "var(--surface-primary-hover)"
      : "var(--surface-primary)",
  transition: "all 0.15s",
  opacity: disabled ? 0.6 : 1,
});

export const mediaPreviewContainerStyle: CSSProperties = {
  aspectRatio: "16/9",
  backgroundColor: "var(--surface-secondary)",
};

export const mediaNameContainerStyle: CSSProperties = {
  padding: "8px",
  fontSize: "12px",
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  display: "flex",
  alignItems: "center",
  gap: "4px",
};

export const videoIconStyle: CSSProperties = {
  flexShrink: 0,
  fontSize: "12px",
  color: "var(--secondary)",
};

export const mediaNameTextStyle: CSSProperties = {
  overflow: "hidden",
  textOverflow: "ellipsis",
};
