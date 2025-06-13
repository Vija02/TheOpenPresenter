import "@fontsource-variable/inter";
import "@fontsource-variable/source-sans-3";
import { Logo } from "@repo/ui";
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
        background:
          "linear-gradient(-73deg, rgb(10, 10, 10) 0%, rgb(23,23,23) 100%)",
      }}
    >
      <div>
        <Logo height={40} />
        <div className="mb-6 md:mb-10 xl:mb-16" />
        <h1>Choose something to display</h1>
        <div className="mb-4 md:mb-7" />
        <p>
          This screen loaded perfectly! <br />
          Select something in your device to start presenting.
        </p>
        <div className="mb-7" />
      </div>
      <div className="flex gap-10 items-center">
        <QRCode
          style={{
            height: "auto",
            maxHeight: 256,
            padding: 20,
            background: "white",
          }}
          value={qrcodeUrl}
        />
      </div>
    </div>
  );
};
export default Landing;
