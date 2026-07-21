import { useMemo } from "react";
import QRCode from "react-qr-code";
import { useParams } from "wouter";

const Landing = () => {
  const params = useParams();

  const { orgSlug, projectSlug } = params;

  const qrcodeUrl = useMemo(
    () => `${window.location.origin}/app/${orgSlug}/${projectSlug}`,
    [orgSlug, projectSlug],
  );

  return (
    <div
      className="landing"
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 20,
        background:
          "linear-gradient(-73deg, rgb(10, 10, 10) 0%, rgb(23,23,23) 100%)",
      }}
    >
      <p style={{ fontWeight: 200 }}>Waiting for input...</p>
      <QRCode
        style={{
          height: "auto",
          maxHeight: 256,
          padding: 10,
          background: "white",
        }}
        value={qrcodeUrl}
      />
    </div>
  );
};
export default Landing;
