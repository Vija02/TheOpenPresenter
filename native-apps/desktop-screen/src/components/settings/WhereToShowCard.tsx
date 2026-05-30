import type { MonitorInfo } from "./types";

type Props = {
  monitors: MonitorInfo[];
  value: string;
  onChange: (value: string) => void;
};

/** Monitor selector */
export function WhereToShowCard({ monitors, value, onChange }: Props) {
  return (
    <section className="settings-card">
      <h2>Where to show</h2>
      <p className="settings-help">
        Pick which physical display the screen window opens on.
      </p>
      <select
        className="settings-select"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      >
        <option value="current">Current monitor (don't move)</option>
        {monitors.map((m, i) => (
          <option key={m.name} value={m.name}>
            {`Monitor ${i + 1}${m.is_primary ? " (primary)" : ""} — ${m.width}×${m.height} — ${m.name}`}
          </option>
        ))}
      </select>
    </section>
  );
}
