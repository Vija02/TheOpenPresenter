import { Button, PopConfirm } from "@repo/ui";
import {
  VscChevronDown,
  VscChevronUp,
  VscEdit,
  VscTrash,
} from "react-icons/vsc";

import { formatDurationForInput } from "../../../src/timerUtils";
import { TimerItem } from "../../../src/types";

type TimerListProps = {
  timers: TimerItem[];
  activeIndex: number;
  isRunning: boolean;
  onSelect: (index: number) => void;
  onEdit: (index: number) => void;
  onDelete: (index: number) => void;
  onMoveUp: (index: number) => void;
  onMoveDown: (index: number) => void;
};

export const TimerList = ({
  timers,
  activeIndex,
  isRunning,
  onSelect,
  onEdit,
  onDelete,
  onMoveUp,
  onMoveDown,
}: TimerListProps) => {
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
        const isActive = index === activeIndex;

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
