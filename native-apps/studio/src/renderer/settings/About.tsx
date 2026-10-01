import { Button } from "@repo/ui";
import { useEffect, useState } from "react";

import { type AboutInfo, api } from "../bridge/ipc";
import { Logo } from "../shared/Logo";
import { AppUpdate } from "./AppUpdate";

export function About() {
  const [info, setInfo] = useState<AboutInfo | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    api
      .aboutInfo()
      .then(setInfo)
      .catch(() => setInfo(null));
  }, []);

  const copy = async () => {
    if (!info) return;
    await api.copyText(
      [
        `App       ${info.appVersion}`,
        `Runtime   ${info.runtimeVersion ?? "not installed"}`,
        `Manager   ${info.managerVersion ?? "unavailable"}`,
        `Electron  ${info.electron}`,
        `Chrome    ${info.chrome}`,
        `Node      ${info.node}`,
        `Server    ${info.connection}`,
      ].join("\n"),
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <section className="about">
      <Logo className="about-mark" />
      <h2>TheOpenPresenter</h2>
      <p className="muted">Version {info?.appVersion ?? "…"}</p>

      <AppUpdate />

      <div className="about-group">
        <h3>Connection</h3>
        <dl className="facts">
          <dt>Mode</dt>
          <dd>{info?.mode ?? "…"}</dd>
          <dt>Instance</dt>
          <dd className="mono">{info?.connection ?? "…"}</dd>
        </dl>
      </div>

      <div className="about-group">
        <h3>Components</h3>
        <dl className="facts">
          <dt>Runtime</dt>
          <dd className="mono">
            {info?.runtimeVersion ?? "Not installed"}
            {info?.runtimeVersion && (
              <span className="muted">
                {info.runtimeRunning ? " · running" : " · stopped"}
              </span>
            )}
          </dd>
          <dt>Manager</dt>
          <dd className="mono">{info?.managerVersion ?? "Unavailable"}</dd>
          <dt>Electron</dt>
          <dd className="mono">{info?.electron ?? "…"}</dd>
          <dt>Chrome</dt>
          <dd className="mono">{info?.chrome ?? "…"}</dd>
          <dt>Node</dt>
          <dd className="mono">{info?.node ?? "…"}</dd>
        </dl>
      </div>

      <div className="row">
        <Button variant="outline" onClick={() => void copy()} disabled={!info}>
          {copied ? "Copied" : "Copy details"}
        </Button>
        <Button variant="link" onClick={() => void api.openWebsite()}>
          Website
        </Button>
      </div>
    </section>
  );
}
