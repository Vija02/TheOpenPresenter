import { invoke } from "@tauri-apps/api/core";
import { type UnlistenFn, listen } from "@tauri-apps/api/event";
import { openUrl } from "@tauri-apps/plugin-opener";
import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";

import {
  DEFAULT_ROOT_URL,
  getRootUrl,
  normalizeHost,
  setRootUrl,
} from "../utils/config";

type SsePayload = {
  id?: string;
  done?: boolean;
  token?: string;
};

type Props = {
  /** Called once the SSE handshake logs this device in (session established). */
  onLoggedIn: () => void;
};

type Phase = "host" | "pairing";
type PairStatus = "connecting" | "ready" | "error";

export function Setup({ onLoggedIn }: Props) {
  const [host, setHost] = useState(() => getRootUrl());
  const [hostInput, setHostInput] = useState(() => getRootUrl());
  const [phase, setPhase] = useState<Phase>(() =>
    getRootUrl() ? "pairing" : "host",
  );

  // Host-step state.
  const [checking, setChecking] = useState(false);
  const [hostError, setHostError] = useState<string | null>(null);

  // Pairing-step state.
  const [qrId, setQRId] = useState<string | null>(null);
  const [pairStatus, setPairStatus] = useState<PairStatus>("connecting");
  const [pairError, setPairError] = useState<string | null>(null);
  const [finishing, setFinishing] = useState(false);

  const onContinue = async () => {
    const normalized = normalizeHost(hostInput);
    if (!normalized) {
      setHostError("Enter a server URL.");
      return;
    }
    setChecking(true);
    setHostError(null);
    try {
      const ok = await invoke<boolean>("check_host", { url: normalized });
      if (!ok) {
        setHostError(
          "Couldn't reach this server. Check the URL and try again.",
        );
        return;
      }
      await setRootUrl(normalized);
      setHost(normalized);
      setHostInput(normalized);
      setPhase("pairing");
    } catch (e) {
      setHostError(String(e));
    } finally {
      setChecking(false);
    }
  };

  // Pairing SSE — only while on the pairing phase and a host is set.
  useEffect(() => {
    if (phase !== "pairing") return;
    if (!host) {
      setPhase("host");
      return;
    }

    setPairStatus("connecting");
    setPairError(null);
    setQRId(null);
    setFinishing(false);

    let cancelled = false;
    const unlistens: UnlistenFn[] = [];

    (async () => {
      const offMessage = await listen<string>("pairing-message", (event) => {
        try {
          const data = JSON.parse(event.payload) as SsePayload;

          if (data.id) {
            setQRId(data.id);
            setPairStatus("ready");
          }

          if (data.done && data.token) {
            const token = data.token;
            invoke("stop_pairing").catch(() => {});
            setFinishing(true);

            (async () => {
              try {
                await invoke("establish_session", { token, rootUrl: host });
                onLoggedIn();
              } catch (e) {
                if (cancelled) return;
                setPairStatus("error");
                setPairError(String(e));
                setFinishing(false);
              }
            })();
          }
        } catch {
          // Server keep-alive / heartbeat — ignore parse errors.
        }
      });

      const offError = await listen<string>("pairing-error", (event) => {
        setPairStatus((prev) => (prev === "ready" ? prev : "error"));
        setPairError((prev) => prev ?? event.payload ?? "Connection error");
      });

      unlistens.push(offMessage, offError);

      if (cancelled) {
        unlistens.forEach((u) => u());
        return;
      }

      try {
        await invoke("start_pairing", { rootUrl: host });
      } catch (e) {
        setPairStatus("error");
        setPairError(String(e));
      }
    })();

    return () => {
      cancelled = true;
      unlistens.forEach((u) => u());
      invoke("stop_pairing").catch(() => {});
    };
  }, [phase, host, onLoggedIn]);

  const authUrl = qrId ? `${host}/qr-auth/auth?id=${qrId}` : null;

  return (
    <div className="login">
      <div className="login-card">
        <h1 className="login-brand">TheOpenPresenter</h1>

        {phase === "host" ? (
          <div className="login-host">
            <p className="login-sub">Connect this device to your server.</p>

            <label className="login-label" htmlFor="host-input">
              Server URL
            </label>
            <input
              id="host-input"
              className="login-input"
              type="text"
              autoFocus
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              placeholder={DEFAULT_ROOT_URL}
              value={hostInput}
              onChange={(e) => setHostInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !checking) void onContinue();
              }}
            />
            {hostError && <p className="login-error">{hostError}</p>}

            <button
              className="login-btn"
              onClick={() => void onContinue()}
              disabled={checking || !hostInput.trim()}
            >
              {checking ? "Checking…" : "Continue"}
            </button>
          </div>
        ) : (
          <div className="login-pairing">
            <p className="login-sub">Scan to sign in with your phone.</p>

            <div className="login-qr-card">
              {pairStatus === "ready" && authUrl && !finishing && (
                <QRCodeSVG size={216} value={authUrl} />
              )}
              {(pairStatus === "connecting" || finishing) && (
                <div className="login-qr-filler">
                  <div className="spinner" />
                  <span>{finishing ? "Signing in…" : "Generating code…"}</span>
                </div>
              )}
              {pairStatus === "error" && !finishing && (
                <div className="login-qr-filler">
                  <strong className="login-error-title">
                    Connection failed
                  </strong>
                  <span className="login-error-detail">
                    Could not reach {host}
                  </span>
                  {pairError && (
                    <span className="login-error-message">{pairError}</span>
                  )}
                </div>
              )}
            </div>

            {pairStatus === "ready" && authUrl && !finishing && (
              <button
                type="button"
                className="login-open-btn"
                onClick={() => {
                  void openUrl(authUrl);
                }}
              >
                Open sign-in page in browser
              </button>
            )}

            <div className="login-status">
              <span
                className={`status-dot ${
                  pairStatus === "ready"
                    ? "status-dot-ready"
                    : pairStatus === "error"
                      ? "status-dot-error"
                      : ""
                }`}
              />
              <span className="login-status-text">
                {finishing
                  ? "Signing in…"
                  : pairStatus === "ready"
                    ? "Waiting for sign-in…"
                    : pairStatus === "error"
                      ? "Connection error"
                      : "Connecting to server…"}
              </span>
            </div>

            <div className="login-server-row">
              <span className="login-server-host">{host}</span>
              <button
                type="button"
                className="login-link"
                onClick={() => {
                  setHostInput(host);
                  setPhase("host");
                }}
              >
                Change server
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
