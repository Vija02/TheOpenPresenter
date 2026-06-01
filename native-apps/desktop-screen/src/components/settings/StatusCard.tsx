import { openUrl } from "@tauri-apps/plugin-opener";

import type { Screen } from "../../utils/config";
import type { HostStatus } from "./types";

type Props = {
  rootUrl: string;
  hostStatus: HostStatus;
  hostError: string | null;
  screen: Screen;
};

export function StatusCard({ rootUrl, hostStatus, hostError, screen }: Props) {
  const screenLabel = screen.screenName
    ? `${screen.orgName ?? screen.orgSlug} / ${screen.screenName}`
    : `${screen.orgSlug} / ${screen.screenSlug}`;

  const pillVariant =
    hostStatus === "ok" ? "ok" : hostStatus === "down" ? "down" : "muted";
  const pillText =
    hostStatus === "ok"
      ? "Reachable"
      : hostStatus === "down"
        ? "Unreachable"
        : "Checking…";

  const trimmedRoot = rootUrl.replace(/\/+$/, "");
  const remoteUrl =
    trimmedRoot && screen.orgSlug && screen.screenSlug
      ? `${trimmedRoot}/o/${screen.orgSlug}/screens/${screen.screenSlug}/control`
      : "";

  const openControlPanel = () => {
    if (!remoteUrl) return;
    openUrl(remoteUrl).catch(() => {});
  };

  return (
    <section className="settings-card">
      <h2>Status</h2>
      <dl className="settings-dl">
        <dt>Server</dt>
        <dd className="settings-dd-mono">{rootUrl || "(not configured)"}</dd>

        <dt>Reachable</dt>
        <dd>
          <span className={`pill pill-${pillVariant}`}>{pillText}</span>
          {hostError && <span className="settings-error"> {hostError}</span>}
        </dd>

        <dt>Paired screen</dt>
        <dd className="settings-dd-mono">{screenLabel}</dd>
      </dl>
      <div className="settings-actions" style={{ marginTop: "1rem" }}>
        <button
          className="settings-btn"
          onClick={openControlPanel}
          disabled={!remoteUrl}
          title={remoteUrl || undefined}
        >
          Open control panel ↗
        </button>
      </div>
    </section>
  );
}
