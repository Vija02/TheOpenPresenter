type Props = {
  autostart: boolean;
  requireHostReachable: boolean;
  onAutostartChange: (value: boolean) => void;
  onHostReachableChange: (value: boolean) => void;
};

export function StartupCard({
  autostart,
  requireHostReachable,
  onAutostartChange,
  onHostReachableChange,
}: Props) {
  return (
    <section className="settings-card">
      <h2>Startup</h2>

      <label className="settings-check">
        <input
          type="checkbox"
          checked={autostart}
          onChange={(e) => onAutostartChange(e.target.checked)}
        />
        <span>
          <strong>Start automatically on login</strong>
          <span className="settings-help">
            Register this app to launch when you sign in to this computer. When
            enabled, the screen window also opens on launch (kiosk mode);
            otherwise only this Settings window opens and you can show the
            screen manually with the buttons above.
          </span>
        </span>
      </label>

      <label className="settings-check">
        <input
          type="checkbox"
          checked={requireHostReachable}
          onChange={(e) => onHostReachableChange(e.target.checked)}
        />
        <span>
          <strong>Only start when host is reachable</strong>
          <span className="settings-help">
            On launch, wait until the server responds before showing the screen.
            Useful if the network or server is slower than the kiosk on cold
            boot.
          </span>
        </span>
      </label>
    </section>
  );
}
