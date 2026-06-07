import { ScreenFragment, ScreenIdlePolicy } from "@repo/graphql";
import { NumberInput, Select } from "@repo/ui";

import { formatSeconds, parseSeconds } from "./shared";

export type IdlePatch = Partial<{
  idlePolicy: ScreenIdlePolicy;
  idleAfterSeconds: number | null;
  unassignAfterIdleSeconds: number | null;
  showBarOnIdle: boolean;
}>;

const idlePolicyOptions: {
  label: string;
  value: ScreenIdlePolicy;
  isDisabled?: boolean;
}[] = [
  { label: "Do nothing", value: ScreenIdlePolicy.DoNothing },
  {
    label: "Unassign the screen",
    value: ScreenIdlePolicy.Unassign,
  },
];

export const IdleSettingsCard = ({
  screen,
  onUpdate,
}: {
  screen: ScreenFragment;
  onUpdate: (patch: IdlePatch) => void;
}) => {
  const policy = screen.idlePolicy;
  return (
    <div className="border border-stroke rounded p-4">
      <h2 className="text-lg font-semibold mb-1">Idle behaviour</h2>
      <p className="text-sm text-secondary mb-4">
        What happens when the active controller stops sending input. The screen
        is considered idle once it hasn't received a heartbeat for the
        configured number of seconds.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-sm md:col-span-2">
          <span className="block text-secondary mb-1">
            Consider idle when no activity for
          </span>
          <NumberInput
            value={screen.idleAfterSeconds ?? undefined}
            min={1}
            step={1}
            precision={0}
            formatValue={formatSeconds}
            parseValue={parseSeconds}
            className="mt-1 max-w-xs"
            onChange={(v) => onUpdate({ idleAfterSeconds: v ?? null })}
          />
        </label>

        <label className="text-sm">
          <span className="block text-secondary mb-1">
            When screen goes idle
          </span>
          <Select
            value={idlePolicyOptions.find((o) => o.value === policy) ?? null}
            options={idlePolicyOptions}
            isSearchable={false}
            isClearable={false}
            onChange={(opt) => {
              if (opt) {
                onUpdate({ idlePolicy: opt.value as ScreenIdlePolicy });
              }
            }}
          />
        </label>

        {policy === ScreenIdlePolicy.Unassign && (
          <label className="text-sm">
            <span className="block text-secondary mb-1">Unassign after</span>
            <NumberInput
              value={screen.unassignAfterIdleSeconds ?? undefined}
              min={1}
              step={1}
              precision={0}
              formatValue={formatSeconds}
              parseValue={parseSeconds}
              className="mt-1"
              onChange={(v) =>
                onUpdate({ unassignAfterIdleSeconds: v ?? null })
              }
            />
          </label>
        )}

        <label className="flex items-center gap-2 text-sm md:col-span-2 mt-1">
          <input
            type="checkbox"
            checked={screen.showBarOnIdle}
            onChange={(e) => onUpdate({ showBarOnIdle: e.target.checked })}
          />
          <span>
            Show screen info when it is idle
            <span className="block text-xs text-tertiary">
              Overlays a banner on the screen to help users to reconnect
            </span>
          </span>
        </label>
      </div>
    </div>
  );
};
