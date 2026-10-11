import {
  Button,
  Label,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Switch,
  ToggleGroup,
  ToggleGroupItem,
} from "@repo/ui";
import { cx } from "class-variance-authority";
import { ReactNode, useId } from "react";
import { VscSettingsGear, VscZoomIn, VscZoomOut } from "react-icons/vsc";

import {
  FONT_STEP,
  MAX_FONT_SIZE,
  MIN_FONT_SIZE,
  type MusicianSettings,
  type MusicianSettingsPatch,
  type StylePatch,
  type StyleScope,
} from "./useMusicianSettings";

type SettingsPanelProps = {
  settings: MusicianSettings;
  onChange: (patch: MusicianSettingsPatch) => void;
  onStyleChange: (patch: StylePatch) => void;
  onStyleScopeChange: (scope: StyleScope) => void;
  hasSong: boolean;
  hasChords: boolean;
};

const SwitchRow = ({
  label,
  description,
  testId,
  checked,
  disabled,
  onCheckedChange,
}: {
  label: ReactNode;
  description?: ReactNode;
  testId: string;
  checked: boolean;
  disabled?: boolean;
  onCheckedChange: (checked: boolean) => void;
}) => {
  const id = useId();
  return (
    <div className="flex items-center justify-between gap-3 py-1.5">
      <Label htmlFor={id} className="flex flex-col items-start gap-0.5">
        <span>{label}</span>
        {description !== undefined && (
          <span className="text-xs font-normal text-secondary">
            {description}
          </span>
        )}
      </Label>
      <Switch
        id={id}
        data-testid={testId}
        checked={checked}
        disabled={disabled}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
};

const FontSizeRow = ({
  settings,
  onStyleChange,
}: Pick<SettingsPanelProps, "settings" | "onStyleChange">) => (
  <div className="flex items-center justify-between gap-3 py-1.5">
    <span className="flex items-baseline gap-2 text-sm font-medium">
      Text size
      {!settings.isDefaultFontSize && (
        <button
          type="button"
          data-testid="ly-musician-font-size-reset"
          className="text-xs font-normal text-secondary underline"
          onClick={() => onStyleChange({ fontSize: null })}
        >
          Default
        </button>
      )}
    </span>
    <div className="flex items-center gap-1">
      <Button
        variant="ghost"
        size="sm"
        disabled={settings.fontSize <= MIN_FONT_SIZE}
        onClick={() =>
          onStyleChange({ fontSize: settings.fontSize - FONT_STEP })
        }
        title="Smaller text"
        aria-label="Smaller text"
      >
        <VscZoomOut />
      </Button>
      <span
        data-testid="ly-musician-font-size"
        className="w-8 text-center text-sm tabular-nums"
      >
        {settings.fontSize}
      </span>
      <Button
        variant="ghost"
        size="sm"
        disabled={settings.fontSize >= MAX_FONT_SIZE}
        onClick={() =>
          onStyleChange({ fontSize: settings.fontSize + FONT_STEP })
        }
        title="Larger text"
        aria-label="Larger text"
      >
        <VscZoomIn />
      </Button>
    </div>
  </div>
);

export const SettingsPanel = ({
  settings,
  onChange,
  onStyleChange,
  onStyleScopeChange,
  hasSong,
  hasChords,
}: SettingsPanelProps) => (
  <Popover>
    <PopoverTrigger asChild>
      <Button
        data-testid="ly-musician-settings"
        variant="ghost"
        size="sm"
        title="Settings"
        aria-label="Settings"
      >
        <VscSettingsGear />
      </Button>
    </PopoverTrigger>
    <PopoverContent
      align="end"
      hideArrow
      // Rendered outside the view, so it takes the theme itself
      className={cx(
        "w-72 p-3",
        // The dark theme keeps light-theme fills, which barely show on dark
        settings.theme === "dark" &&
          "dark [color-scheme:dark] [&_[data-slot=switch][data-state=checked]]:bg-[#f5b547] [&_[data-slot=toggle-group-item][data-state=on]]:bg-[#f5b547] [&_[data-slot=toggle-group-item][data-state=on]]:text-black",
      )}
      data-testid="ly-musician-settings-panel"
    >
      <p className="mb-1 text-sm font-semibold">Settings</p>

      <SwitchRow
        label="Chords"
        description={hasChords ? undefined : "This song has none"}
        testId="ly-musician-chords"
        checked={settings.showChords}
        disabled={!hasChords}
        onCheckedChange={(showChords) => onChange({ showChords })}
      />
      <SwitchRow
        label="Dark background"
        testId="ly-musician-dark"
        checked={settings.theme === "dark"}
        onCheckedChange={(dark) => onChange({ theme: dark ? "dark" : "light" })}
      />
      <SwitchRow
        label="Follow visual"
        description="Highlights and follows the live lines"
        testId="ly-musician-follow-visual"
        checked={settings.followVisual}
        onCheckedChange={(followVisual) => onChange({ followVisual })}
      />
      {settings.followVisual && (
        <SwitchRow
          label="Refollow on song change"
          description="After going ahead to a song"
          testId="ly-musician-autofollow"
          checked={settings.autoFollow}
          onCheckedChange={(autoFollow) => onChange({ autoFollow })}
        />
      )}

      <div className="mt-2 flex items-center justify-between gap-3 border-t border-stroke pt-3 pb-1">
        <p className="text-sm font-semibold">Style</p>
        {hasSong && (
          <ToggleGroup
            type="single"
            size="sm"
            value={settings.styleScope}
            aria-label="Style for"
            data-testid="ly-musician-style-scope"
            onValueChange={(scope) => {
              if (scope) onStyleScopeChange(scope as StyleScope);
            }}
          >
            <ToggleGroupItem value="all" className="px-2 text-xs">
              All songs
            </ToggleGroupItem>
            <ToggleGroupItem value="song" className="px-2 text-xs">
              This song
            </ToggleGroupItem>
          </ToggleGroup>
        )}
      </div>

      <SwitchRow
        label="Fit the whole song"
        description="As large as it fits on screen"
        testId="ly-musician-autofit"
        checked={settings.autoFit}
        onCheckedChange={(autoFit) => onStyleChange({ autoFit })}
      />
      {!settings.autoFit && (
        <>
          <FontSizeRow settings={settings} onStyleChange={onStyleChange} />
          <SwitchRow
            label="Scroll with the song"
            description="Keeps the live lines in view"
            testId="ly-musician-autoscroll"
            checked={settings.autoScroll}
            onCheckedChange={(autoScroll) => onStyleChange({ autoScroll })}
          />
        </>
      )}
    </PopoverContent>
  </Popover>
);
