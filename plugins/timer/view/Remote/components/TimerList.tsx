import { Badge, Button, PopConfirm } from "@repo/ui";
import { useEffect, useState } from "react";
import {
  VscArrowRight,
  VscChevronDown,
  VscChevronUp,
  VscEdit,
  VscTrash,
} from "react-icons/vsc";

import {
  calculateEffectiveTimerState,
  formatDurationForInput,
} from "../../../src/timerUtils";
import { TimerItem } from "../../../src/types";

type TimerListProps = {
  timers: TimerItem[];
  baseTimerIndex: number;
  isRunning: boolean;
  timeStarted: number | null;
  timeAdjustment: number;
  onSelect: (index: number) => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
};

export const TimerList = ({
  timers,
  baseTimerIndex,
  isRunning,
  timeStarted,
  timeAdjustment,
  onSelect,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: TimerListProps) => {
  const [, setTick] = useState(0);

  // Force re-render every 100ms when running to update effective index
  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setTick((t) => t + 1);
    }, 100);

    return () => clearInterval(interval);
  }, [isRunning]);

  // Calculate effective timer index
  const { effectiveTimerIndex } = calculateEffectiveTimerState(
    timers,
    baseTimerIndex,
    timeStarted,
    isRunning,
    timeAdjustment,
  );
  if (timers.length === 0) {
    return (
      <div className="text-center text-gray-500 py-8">
        No timers yet. Add one to get started.
      </div>
    );
  }

  return (
    <div className="space-y-1">
      {timers.map((timer, index) => {
        const isActive = index === effectiveTimerIndex;

        return (
          <div
            key={timer.id}
            className={`
              flex items-center gap-2 p-2 rounded-md cursor-pointer
              transition-colors
              ${isActive ? "bg-primary/20 border border-primary/50" : "bg-muted/50 hover:bg-muted"}
              ${isActive && isRunning ? "ring-2 ring-green-500/50" : ""}
            `}
            onClick={() => onSelect(index)}
          >
            {/* Index number */}
            <span className="text-xs text-muted-foreground w-5 text-center">
              {index + 1}
            </span>

            {/* Timer info */}
            <div className="flex-1 min-w-0">
              <div className="font-medium truncate text-sm">
                {timer.title || "Untitled"}
              </div>
            </div>

            {/* At Zero Behavior */}
            {timer.overtimeBehavior === "stop" && (
              <Badge
                variant="default"
                className="text-[10px] px-1.5 py-0 h-5 shrink-0"
              >
                no-proceed
              </Badge>
            )}
            {timer.overtimeBehavior === "continue" && (
              <Badge
                variant="destructive"
                className="text-[10px] px-1.5 py-0 h-5 shrink-0"
              >
                count overflow
              </Badge>
            )}
            {timer.overtimeBehavior === "next" && (
              <Badge
                variant="default"
                className="text-[10px] px-1.5 py-0 h-5 shrink-0"
              >
                <VscArrowRight className="w-3 h-3 mr-0.5" />
                auto-proceed
              </Badge>
            )}

            {/* Duration */}
            <span className="text-sm font-mono text-muted-foreground">
              {formatDurationForInput(timer.duration)}
            </span>

            {/* Action buttons */}
            <div
              className="flex items-center gap-0.5"
              onClick={(e) => e.stopPropagation()}
            >
              <Button
                size="xs"
                variant="ghost"
                onClick={() => onMoveUp(index)}
                disabled={index === 0}
                className="h-6 w-6 p-0"
              >
                <VscChevronUp className="w-3 h-3" />
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => onMoveDown(index)}
                disabled={index === timers.length - 1}
                className="h-6 w-6 p-0"
              >
                <VscChevronDown className="w-3 h-3" />
              </Button>
              <Button
                size="xs"
                variant="ghost"
                onClick={() => onEdit(index)}
                className="h-6 w-6 p-0"
              >
                <VscEdit className="w-3 h-3" />
              </Button>
              <PopConfirm
                title="Delete this timer?"
                onConfirm={() => onDelete(index)}
                okText="Delete"
                cancelText="Cancel"
              >
                <Button
                  size="xs"
                  variant="ghost"
                  className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                >
                  <VscTrash className="w-3 h-3" />
                </Button>
              </PopConfirm>
            </div>
          </div>
        );
      })}
    </div>
  );
};
