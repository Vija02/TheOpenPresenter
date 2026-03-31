import { Button, PluginScaffold } from "@repo/ui";
import { useCallback, useEffect, useState } from "react";
import { VscAdd } from "react-icons/vsc";

import {
  calculateEffectiveTimerState,
  createDefaultTimer,
  generateId,
} from "../../src/timerUtils";
import { TimerItem } from "../../src/types";
import { usePluginAPI } from "../pluginApi";
import { TimerEditor } from "./components/TimerEditor";
import { TimerList } from "./components/TimerList";
import { TimerPreview } from "./components/TimerPreview";
import { TransportControls } from "./components/TransportControls";
import "./index.css";

const Remote = () => {
  const pluginApi = usePluginAPI();

  // Scene data (persistent config)
  const timers = pluginApi.scene.useData((x) => x.pluginData.timers) ?? [];
  const defaultWrapUpYellow =
    pluginApi.scene.useData((x) => x.pluginData.defaultWrapUpYellow) ?? 60;
  const defaultWrapUpRed =
    pluginApi.scene.useData((x) => x.pluginData.defaultWrapUpRed) ?? 30;

  // Renderer data (runtime state)
  const activeTimerIndex =
    pluginApi.renderer.useData((x) => x.activeTimerIndex) ?? 0;
  const isRunning = pluginApi.renderer.useData((x) => x.isRunning) ?? false;
  const timeStarted = pluginApi.renderer.useData((x) => x.timeStarted);
  const timeAdjustment =
    pluginApi.renderer.useData((x) => x.timeAdjustment) ?? 0;
  const isBlackout = pluginApi.renderer.useData((x) => x.isBlackout) ?? false;

  // Mutable data for updates
  const mutableSceneData = pluginApi.scene.useValtioData();
  const mutableRendererData = pluginApi.renderer.useValtioData();

  // Editor modal state
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const { effectiveTimerIndex } = calculateEffectiveTimerState(
    timers,
    activeTimerIndex,
    timeStarted,
    isRunning,
    timeAdjustment,
  );

  // Add default timer if empty on mount
  useEffect(() => {
    if (timers.length === 0) {
      const defaultTimer = createDefaultTimer(
        generateId(),
        defaultWrapUpYellow,
        defaultWrapUpRed,
      );
      mutableSceneData.pluginData.timers.push(defaultTimer);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Timer actions
  const handlePlayPause = useCallback(() => {
    if (isRunning) {
      // Pause - store current adjustment
      mutableRendererData.isRunning = false;
    } else {
      // Start - align to the beginning of the current second so timer syncs with TOD
      const now = Date.now();
      const alignedTime = Math.floor(now / 1000) * 1000;
      mutableRendererData.isRunning = true;
      mutableRendererData.timeStarted = alignedTime;
      mutableRendererData.timeAdjustment = 0;
    }
  }, [isRunning, mutableRendererData]);

  const handleReset = useCallback(() => {
    mutableRendererData.isRunning = false;
    mutableRendererData.timeStarted = null;
    mutableRendererData.timeAdjustment = 0;
  }, [mutableRendererData]);

  const handlePrevious = useCallback(() => {
    if (effectiveTimerIndex > 0) {
      mutableRendererData.activeTimerIndex = effectiveTimerIndex - 1;
      const now = Date.now();
      const alignedTime = Math.floor(now / 1000) * 1000;
      mutableRendererData.timeStarted = alignedTime;
      mutableRendererData.timeAdjustment = 0;
    }
  }, [effectiveTimerIndex, mutableRendererData]);

  const handleNext = useCallback(() => {
    if (effectiveTimerIndex < timers.length - 1) {
      mutableRendererData.activeTimerIndex = effectiveTimerIndex + 1;
      const now = Date.now();
      const alignedTime = Math.floor(now / 1000) * 1000;
      mutableRendererData.timeStarted = alignedTime;
      mutableRendererData.timeAdjustment = 0;
    }
  }, [effectiveTimerIndex, timers.length, mutableRendererData]);

  const handleNudge = useCallback(
    (ms: number) => {
      mutableRendererData.timeAdjustment = timeAdjustment + ms;
    },
    [timeAdjustment, mutableRendererData],
  );

  const handleToggleBlackout = useCallback(() => {
    mutableRendererData.isBlackout = !isBlackout;
  }, [isBlackout, mutableRendererData]);

  const handleOpenInView = useCallback(() => {
    pluginApi.renderer.setRenderCurrentScene();
  }, [pluginApi.renderer]);

  // Timer list actions
  const handleSelectTimer = useCallback(
    (index: number) => {
      if (index !== effectiveTimerIndex) {
        mutableRendererData.activeTimerIndex = index;
        mutableRendererData.isRunning =
          timers[index]?.mode === "countdownToTime";
        mutableRendererData.timeStarted = null;
        mutableRendererData.timeAdjustment = 0;
      }
    },
    [effectiveTimerIndex, mutableRendererData, timers],
  );

  const handleEditTimer = useCallback((index: number) => {
    setEditingIndex(index);
    setIsEditorOpen(true);
  }, []);

  const handleDeleteTimer = useCallback(
    (index: number) => {
      mutableSceneData.pluginData.timers.splice(index, 1);

      // Adjust active index if needed
      if (effectiveTimerIndex >= timers.length - 1 && effectiveTimerIndex > 0) {
        mutableRendererData.activeTimerIndex = effectiveTimerIndex - 1;
      }
      // Reset timer state
      mutableRendererData.isRunning = false;
      mutableRendererData.timeStarted = null;
      mutableRendererData.timeAdjustment = 0;
    },
    [
      effectiveTimerIndex,
      timers.length,
      mutableSceneData.pluginData.timers,
      mutableRendererData,
    ],
  );

  const handleMoveUp = useCallback(
    (index: number) => {
      if (index > 0) {
        const timer = mutableSceneData.pluginData.timers[index];
        if (!timer) return;
        mutableSceneData.pluginData.timers.splice(index, 1);
        mutableSceneData.pluginData.timers.splice(index - 1, 0, timer);

        // Update active index if it was affected
        if (effectiveTimerIndex === index) {
          mutableRendererData.activeTimerIndex = index - 1;
        } else if (effectiveTimerIndex === index - 1) {
          mutableRendererData.activeTimerIndex = index;
        }
      }
    },
    [
      effectiveTimerIndex,
      mutableSceneData.pluginData.timers,
      mutableRendererData,
    ],
  );

  const handleMoveDown = useCallback(
    (index: number) => {
      if (index < timers.length - 1) {
        const timer = mutableSceneData.pluginData.timers[index];
        if (!timer) return;
        mutableSceneData.pluginData.timers.splice(index, 1);
        mutableSceneData.pluginData.timers.splice(index + 1, 0, timer);

        // Update active index if it was affected
        if (effectiveTimerIndex === index) {
          mutableRendererData.activeTimerIndex = index + 1;
        } else if (effectiveTimerIndex === index + 1) {
          mutableRendererData.activeTimerIndex = index;
        }
      }
    },
    [
      effectiveTimerIndex,
      timers.length,
      mutableSceneData.pluginData.timers,
      mutableRendererData,
    ],
  );

  const handleAddTimer = useCallback(() => {
    setEditingIndex(null);
    setIsEditorOpen(true);
  }, []);

  const handleSaveTimer = useCallback(
    (timerData: Partial<TimerItem>) => {
      if (editingIndex !== null) {
        // Edit existing timer
        const existingTimer = mutableSceneData.pluginData.timers[editingIndex];
        if (!existingTimer) return;
        Object.assign(existingTimer, timerData);
      } else {
        // Add new timer
        const newTimer: TimerItem = {
          id: generateId(),
          title: timerData.title ?? "New Timer",
          duration: timerData.duration ?? 5 * 60 * 1000,
          mode: timerData.mode ?? "countdown",
          overtimeBehavior: timerData.overtimeBehavior ?? "stop",
          wrapUpYellow: timerData.wrapUpYellow ?? defaultWrapUpYellow,
          wrapUpRed: timerData.wrapUpRed ?? defaultWrapUpRed,
          targetTime: null,
        };
        mutableSceneData.pluginData.timers.push(newTimer);
      }
    },
    [
      editingIndex,
      defaultWrapUpYellow,
      defaultWrapUpRed,
      mutableSceneData.pluginData.timers,
    ],
  );

  return (
    <PluginScaffold
      title="Timer"
      toolbar={
        <Button size="xs" variant="pill" onClick={handleAddTimer}>
          <VscAdd />
          Add Timer
        </Button>
      }
      body={
        <div className="p-3 w-full space-y-4">
          {/* Timer Preview */}
          <TimerPreview
            timers={timers}
            baseTimerIndex={activeTimerIndex}
            isRunning={isRunning}
            timeStarted={timeStarted}
            timeAdjustment={timeAdjustment}
          />

          {/* Transport Controls */}
          <TransportControls
            isRunning={isRunning}
            isBlackout={isBlackout}
            hasTimers={timers.length > 0}
            canGoPrevious={effectiveTimerIndex > 0}
            canGoNext={effectiveTimerIndex < timers.length - 1}
            onPlayPause={handlePlayPause}
            onReset={handleReset}
            onPrevious={handlePrevious}
            onNext={handleNext}
            onNudge={handleNudge}
            onToggleBlackout={handleToggleBlackout}
            onOpenInView={handleOpenInView}
          />

          {/* Timer List */}
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-medium">Rundown</h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {timers.length} timer{timers.length !== 1 ? "s" : ""}
                </span>
                <Button size="xs" variant="outline" onClick={handleAddTimer}>
                  <VscAdd className="w-3 h-3 mr-1" />
                  Add
                </Button>
              </div>
            </div>
            <TimerList
              timers={timers}
              baseTimerIndex={activeTimerIndex}
              isRunning={isRunning}
              timeStarted={timeStarted}
              timeAdjustment={timeAdjustment}
              onSelect={handleSelectTimer}
              onEdit={handleEditTimer}
              onDelete={handleDeleteTimer}
              onMoveUp={handleMoveUp}
              onMoveDown={handleMoveDown}
            />
          </div>

          {/* Timer Editor Dialog */}
          <TimerEditor
            timer={
              editingIndex !== null ? (timers[editingIndex] ?? null) : null
            }
            isOpen={isEditorOpen}
            onClose={() => setIsEditorOpen(false)}
            onSave={handleSaveTimer}
            defaultWrapUpYellow={defaultWrapUpYellow}
            defaultWrapUpRed={defaultWrapUpRed}
          />
        </div>
      }
    />
  );
};

export default Remote;
