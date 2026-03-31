import {
  Button,
  Dialog,
  DialogBody,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Label,
  Select,
} from "@repo/ui";
import { useEffect, useState } from "react";

import { formatDurationForInput, parseDuration } from "../../../src/timerUtils";
import {
  OVERTIME_BEHAVIOR_LABELS,
  OvertimeBehavior,
  TIMER_MODE_LABELS,
  TimerItem,
  TimerMode,
} from "../../../src/types";

type TimerEditorProps = {
  timer: TimerItem | null;
  isOpen: boolean;
  onClose: () => void;
  onSave: (timer: Partial<TimerItem>) => void;
  defaultWrapUpYellow: number;
  defaultWrapUpRed: number;
};

// Convert enums to react-select options
const timerModeOptions = Object.entries(TIMER_MODE_LABELS).map(
  ([value, label]) => ({
    value,
    label,
  }),
);

const overtimeBehaviorOptions = Object.entries(OVERTIME_BEHAVIOR_LABELS).map(
  ([value, label]) => ({
    value,
    label,
  }),
);

export const TimerEditor = ({
  timer,
  isOpen,
  onClose,
  onSave,
  defaultWrapUpYellow,
  defaultWrapUpRed,
}: TimerEditorProps) => {
  const [title, setTitle] = useState("");
  const [durationInput, setDurationInput] = useState("5:00");
  const [mode, setMode] = useState<TimerMode>("countdown");
  const [overtimeBehavior, setOvertimeBehavior] =
    useState<OvertimeBehavior>("stop");
  const [wrapUpYellow, setWrapUpYellow] = useState(defaultWrapUpYellow);
  const [wrapUpRed, setWrapUpRed] = useState(defaultWrapUpRed);

  // Reset form when timer changes
  useEffect(() => {
    if (timer) {
      setTitle(timer.title);
      setDurationInput(formatDurationForInput(timer.duration));
      setMode(timer.mode);
      setOvertimeBehavior(timer.overtimeBehavior);
      setWrapUpYellow(timer.wrapUpYellow);
      setWrapUpRed(timer.wrapUpRed);
    } else {
      // Reset to defaults for new timer
      setTitle("");
      setDurationInput("5:00");
      setMode("countdown");
      setOvertimeBehavior("stop");
      setWrapUpYellow(defaultWrapUpYellow);
      setWrapUpRed(defaultWrapUpRed);
    }
  }, [timer, defaultWrapUpYellow, defaultWrapUpRed]);

  const handleSave = () => {
    const duration = parseDuration(durationInput);
    if (duration === null) {
      // TODO: Show error
      return;
    }

    onSave({
      title: title || "Untitled",
      duration,
      mode,
      overtimeBehavior,
      wrapUpYellow,
      wrapUpRed,
    });
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="md">
        <DialogHeader className="px-4 md:px-6">
          <DialogTitle>{timer ? "Edit Timer" : "Add Timer"}</DialogTitle>
        </DialogHeader>

        <DialogBody className="px-4 md:px-6">
          <div className="grid gap-4">
            {/* Title */}
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Opening, Keynote, Q&A..."
              />
            </div>

            {/* Duration */}
            <div className="grid gap-2">
              <Label htmlFor="duration">Duration</Label>
              <Input
                id="duration"
                value={durationInput}
                onChange={(e) => setDurationInput(e.target.value)}
                placeholder="5:00, 1:30:00, 5m, 90s..."
              />
              <p className="text-xs text-muted-foreground">
                Formats: MM:SS, HH:MM:SS, 5m, 90s, 300
              </p>
            </div>

            {/* Mode */}
            <div className="grid gap-2">
              <Label>Display Mode</Label>
              <Select
                options={timerModeOptions}
                value={timerModeOptions.find((o) => o.value === mode)}
                onChange={(option) =>
                  option && setMode(option.value as TimerMode)
                }
              />
            </div>

            {/* Overtime Behavior */}
            <div className="grid gap-2">
              <Label>At Zero</Label>
              <Select
                options={overtimeBehaviorOptions}
                value={overtimeBehaviorOptions.find(
                  (o) => o.value === overtimeBehavior,
                )}
                onChange={(option) =>
                  option &&
                  setOvertimeBehavior(option.value as OvertimeBehavior)
                }
              />
            </div>

            {/* Wrap-up times */}
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="wrapUpYellow">Yellow at (seconds)</Label>
                <Input
                  id="wrapUpYellow"
                  type="number"
                  value={wrapUpYellow}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setWrapUpYellow(Number.isNaN(val) ? 0 : val);
                  }}
                  min={0}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="wrapUpRed">Red at (seconds)</Label>
                <Input
                  id="wrapUpRed"
                  type="number"
                  value={wrapUpRed}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setWrapUpRed(Number.isNaN(val) ? 0 : val);
                  }}
                  min={0}
                />
              </div>
            </div>
          </div>
        </DialogBody>

        <DialogFooter className="px-4 md:px-6">
          <Button variant="outline" onClick={onClose}>
            Cancel
          </Button>
          <Button onClick={handleSave}>{timer ? "Save" : "Add"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
