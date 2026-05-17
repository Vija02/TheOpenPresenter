import {
  ScreenFragment,
  ScreenOnEmptyPolicy,
  ScreenOnTakeoverPolicy,
} from "@repo/graphql";
import { NumberInput, Select, Switch } from "@repo/ui";

import { formatSeconds, parseSeconds } from "./shared";

const onEmptyOptions: { label: string; value: ScreenOnEmptyPolicy }[] = [
  { label: "Allow", value: ScreenOnEmptyPolicy.Allow },
  { label: "Require approval", value: ScreenOnEmptyPolicy.Request },
];

const onTakeoverOptions: {
  label: string;
  value: ScreenOnTakeoverPolicy;
  isDisabled?: boolean;
}[] = [
  { label: "Allow", value: ScreenOnTakeoverPolicy.Allow },
  { label: "Require approval", value: ScreenOnTakeoverPolicy.Request },
  {
    label: "Timer auto-grant (coming soon)",
    value: ScreenOnTakeoverPolicy.Timer,
    isDisabled: true,
  },
];

export type GuestAccessPatch = Partial<{
  registeredGuestEnabled: boolean;
  registeredGuestOnEmptyPolicy: ScreenOnEmptyPolicy;
  registeredGuestOnTakeoverPolicy: ScreenOnTakeoverPolicy;
  registeredGuestOnTakeoverAfterSeconds: number | null;
  anonGuestEnabled: boolean;
  anonGuestOnEmptyPolicy: ScreenOnEmptyPolicy;
  anonGuestOnTakeoverPolicy: ScreenOnTakeoverPolicy;
  anonGuestOnTakeoverAfterSeconds: number | null;
}>;

type RoleColumn = {
  key: "registered" | "anon";
  label: string;
  description: string;
  enabled: boolean;
  onEmptyPolicy: ScreenOnEmptyPolicy;
  onTakeoverPolicy: ScreenOnTakeoverPolicy;
  onTakeoverAfterSeconds: number | null | undefined;
  patchEnabled: (v: boolean) => GuestAccessPatch;
  patchOnEmpty: (v: ScreenOnEmptyPolicy) => GuestAccessPatch;
  patchOnTakeover: (v: ScreenOnTakeoverPolicy) => GuestAccessPatch;
  patchOnTakeoverSeconds: (s: number | null) => GuestAccessPatch;
};

export const GuestPermissionsCard = ({
  screen,
  onUpdate,
}: {
  screen: ScreenFragment;
  onUpdate: (patch: GuestAccessPatch) => void;
}) => {
  const columns: RoleColumn[] = [
    {
      key: "registered",
      label: "Registered guests",
      description: "Registered guests authenticated with a passcode.",
      enabled: screen.registeredGuestEnabled,
      onEmptyPolicy: screen.registeredGuestOnEmptyPolicy,
      onTakeoverPolicy: screen.registeredGuestOnTakeoverPolicy,
      onTakeoverAfterSeconds: screen.registeredGuestOnTakeoverAfterSeconds,
      patchEnabled: (v) => ({ registeredGuestEnabled: v }),
      patchOnEmpty: (v) => ({ registeredGuestOnEmptyPolicy: v }),
      patchOnTakeover: (v) => ({ registeredGuestOnTakeoverPolicy: v }),
      patchOnTakeoverSeconds: (s) => ({
        registeredGuestOnTakeoverAfterSeconds: s,
      }),
    },
    {
      key: "anon",
      label: "Anonymous guests",
      description: "Anyone who scans the QR code without authenticating.",
      enabled: screen.anonGuestEnabled,
      onEmptyPolicy: screen.anonGuestOnEmptyPolicy,
      onTakeoverPolicy: screen.anonGuestOnTakeoverPolicy,
      onTakeoverAfterSeconds: screen.anonGuestOnTakeoverAfterSeconds,
      patchEnabled: (v) => ({ anonGuestEnabled: v }),
      patchOnEmpty: (v) => ({ anonGuestOnEmptyPolicy: v }),
      patchOnTakeover: (v) => ({ anonGuestOnTakeoverPolicy: v }),
      patchOnTakeoverSeconds: (s) => ({ anonGuestOnTakeoverAfterSeconds: s }),
    },
  ];

  return (
    <div className="border border-stroke rounded p-4">
      <h2 className="text-lg font-semibold mb-1">Guest permissions</h2>
      <p className="text-sm text-secondary mb-4">
        Guests are people who scan the QR code to control this screen without
        being a member of your organization. Each guest type can be turned on or
        off, then gated per action: taking control when nobody has it, or taking
        it from someone who already does. Org members always have full access.
      </p>

      {/* Mobile: stacked per-role sections */}
      <div className="md:hidden space-y-4">
        {columns.map((col) => (
          <RoleSection
            key={col.key}
            column={col}
            onUpdate={onUpdate}
          />
        ))}
      </div>

      {/* md+: table layout */}
      <div className="hidden md:block overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-secondary align-top">
              <th className="font-medium pr-3 py-2 w-40">Action</th>
              {columns.map((col) => (
                <th key={col.key} className="font-medium px-3 py-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-foreground">
                        {col.label}
                      </span>
                      <Switch
                        checked={col.enabled}
                        onCheckedChange={(next) => {
                          if (next === col.enabled) return;
                          onUpdate(col.patchEnabled(next));
                        }}
                      />
                    </div>
                    <p className="text-xs font-normal text-tertiary">
                      {col.description}
                    </p>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-stroke">
              <th className="text-left font-medium py-3 pr-3 align-top">
                Nobody in control
                <p className="text-xs font-normal text-tertiary mt-1">
                  Taking control of the screen when no one else is.
                </p>
              </th>
              {columns.map((col) => {
                const disabled = !col.enabled;
                return (
                  <td key={col.key} className="px-3 py-3 align-top">
                    <Select
                      value={
                        onEmptyOptions.find(
                          (o) => o.value === col.onEmptyPolicy,
                        ) ?? null
                      }
                      options={onEmptyOptions}
                      isSearchable={false}
                      isClearable={false}
                      isDisabled={disabled}
                      onChange={(opt) => {
                        if (opt) onUpdate(col.patchOnEmpty(opt.value));
                      }}
                    />
                  </td>
                );
              })}
            </tr>

            <tr className="border-t border-stroke">
              <th className="text-left font-medium py-3 pr-3 align-top">
                Take over
                <p className="text-xs font-normal text-tertiary mt-1">
                  Taking control from someone who is already controlling the
                  screen.
                </p>
              </th>
              {columns.map((col) => {
                const disabled = !col.enabled;
                return (
                  <td key={col.key} className="px-3 py-3 align-top">
                    <Select
                      value={
                        onTakeoverOptions.find(
                          (o) => o.value === col.onTakeoverPolicy,
                        ) ?? null
                      }
                      options={onTakeoverOptions}
                      isSearchable={false}
                      isClearable={false}
                      isDisabled={disabled}
                      onChange={(opt) => {
                        if (opt) onUpdate(col.patchOnTakeover(opt.value));
                      }}
                    />
                    {col.onTakeoverPolicy === ScreenOnTakeoverPolicy.Timer && (
                      <NumberInput
                        value={col.onTakeoverAfterSeconds ?? undefined}
                        min={1}
                        step={1}
                        precision={0}
                        formatValue={formatSeconds}
                        parseValue={parseSeconds}
                        disabled={disabled}
                        className="mt-1 w-full"
                        onChange={(v) =>
                          onUpdate(col.patchOnTakeoverSeconds(v ?? null))
                        }
                      />
                    )}
                  </td>
                );
              })}
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
};

const RoleSection = ({
  column: col,
  onUpdate,
}: {
  column: RoleColumn;
  onUpdate: (patch: GuestAccessPatch) => void;
}) => {
  const disabled = !col.enabled;
  return (
    <div className="border border-stroke rounded p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium">{col.label}</span>
        <Switch
          checked={col.enabled}
          onCheckedChange={(next) => {
            if (next === col.enabled) return;
            onUpdate(col.patchEnabled(next));
          }}
        />
      </div>
      <p className="text-xs text-tertiary mt-1">{col.description}</p>

      <div className="mt-3 space-y-3">
        <div>
          <p className="text-sm font-medium">Nobody in control</p>
          <p className="text-xs text-tertiary mb-1">
            Taking control of the screen when no one else is.
          </p>
          <Select
            value={
              onEmptyOptions.find((o) => o.value === col.onEmptyPolicy) ?? null
            }
            options={onEmptyOptions}
            isSearchable={false}
            isClearable={false}
            isDisabled={disabled}
            onChange={(opt) => {
              if (opt) onUpdate(col.patchOnEmpty(opt.value));
            }}
          />
        </div>

        <div>
          <p className="text-sm font-medium">Take over</p>
          <p className="text-xs text-tertiary mb-1">
            Taking control from someone who is already controlling the screen.
          </p>
          <Select
            value={
              onTakeoverOptions.find(
                (o) => o.value === col.onTakeoverPolicy,
              ) ?? null
            }
            options={onTakeoverOptions}
            isSearchable={false}
            isClearable={false}
            isDisabled={disabled}
            onChange={(opt) => {
              if (opt) onUpdate(col.patchOnTakeover(opt.value));
            }}
          />
          {col.onTakeoverPolicy === ScreenOnTakeoverPolicy.Timer && (
            <NumberInput
              value={col.onTakeoverAfterSeconds ?? undefined}
              min={1}
              step={1}
              precision={0}
              formatValue={formatSeconds}
              parseValue={parseSeconds}
              disabled={disabled}
              className="mt-2 w-full"
              onChange={(v) =>
                onUpdate(col.patchOnTakeoverSeconds(v ?? null))
              }
            />
          )}
        </div>
      </div>
    </div>
  );
};
