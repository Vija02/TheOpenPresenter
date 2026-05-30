import { useState } from "react";

import { logout as logoutDevice } from "../../utils/config";

type Props = {
  onChangeScreen: () => void;
  onLoggedOut: () => void;
};

export function AccountCard({ onChangeScreen, onLoggedOut }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onLogout = async () => {
    setBusy(true);
    setError(null);
    try {
      await logoutDevice();
      onLoggedOut();
    } catch (e) {
      setError(String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="settings-card">
      <h2>Account</h2>
      <p className="settings-help">
        Switch to a different screen on this account, or sign this device out
        entirely. Signing out clears the session and returns to the QR login.
      </p>
      <div className="settings-actions">
        <button
          className="settings-btn"
          onClick={onChangeScreen}
          disabled={busy}
        >
          Change screen
        </button>
        <button className="settings-btn" onClick={onLogout} disabled={busy}>
          {busy ? "Signing out…" : "Sign out"}
        </button>
      </div>
      {error && <span className="settings-error settings-block">{error}</span>}
    </section>
  );
}
