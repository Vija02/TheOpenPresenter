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

// Close button styles - matches ui--button__ghost with icon size
export const closeButtonStyle: CSSProperties = {
  width: "36px",
  height: "36px",
  background: "none",
  border: "none",
  borderRadius: "4px",
  fontSize: "20px",
  cursor: "pointer",
  padding: 0,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--primary)",
  transition: "all 0.15s",
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

// Cancel button styles - matches ui--button__outline
export const cancelButtonStyle: CSSProperties = {
  height: "36px",
  padding: "0 16px",
  backgroundColor: "var(--surface-primary)",
  color: "var(--primary)",
  border: "1px solid var(--stroke)",
  borderRadius: "4px",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: 500,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  whiteSpace: "nowrap",
  transition: "all 0.15s",
  boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
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

// Upload button styles - matches ui--button__default
export const uploadButtonStyle: CSSProperties = {
  height: "36px",
  padding: "0 16px",
  backgroundColor: "var(--fill-default)",
  color: "var(--fill-default-fg)",
  border: "none",
  borderRadius: "4px",
  cursor: "pointer",
  fontSize: "14px",
  fontWeight: 500,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  gap: "8px",
  whiteSpace: "nowrap",
  transition: "all 0.15s",
  boxShadow: "0 1px 2px 0 rgba(0, 0, 0, 0.05)",
};

export const headerActionsStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "12px",
};
