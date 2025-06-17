import { useData, usePluginData } from "@repo/shared";
import { Button, OverlayToggle, PopConfirm } from "@repo/ui";
import { cx } from "class-variance-authority";
import { useMemo } from "react";
import { RxCross1 } from "react-icons/rx";
import { VscSettingsGear, VscTrash } from "react-icons/vsc";
import { useLocation } from "wouter";

import SceneSettingsModal from "../SceneSettingsModal";
import "./index.css";

export const TopBar = () => {
  const [location] = useLocation();

  const data = useData();
  const mainState = usePluginData().mainState!;

  const selectedScene = useMemo(
    () => (data.data[location.slice(1)] ? location.slice(1) : null),
    [data.data, location],
  );

  return (
    <div className="rt--top-bar">
      <div className="rt--top-bar--left">
        {selectedScene && (
          <>
            <p className="rt-top-bar--scene-name">
              {data.data[selectedScene]?.name}
            </p>
            <div className="rt-top-bar--toolbar">
              <OverlayToggle
                toggler={({ onToggle }) => (
                  <Button
                    size="sm"
                    variant="ghost"
                    role="group"
                    onClick={onToggle}
                  >
                    <VscSettingsGear className="size-3" />
                  </Button>
                )}
              >
                <SceneSettingsModal selectedScene={selectedScene} />
              </OverlayToggle>
              <PopConfirm
                onConfirm={() => {
                  delete mainState.data[selectedScene];
                  if (mainState.renderer["1"]?.currentScene === selectedScene) {
                    mainState.renderer["1"]!.currentScene = null;
                  }
                }}
              >
                <Button size="sm" variant="ghost" role="group">
                  <VscTrash className="size-3.5" />
                </Button>
              </PopConfirm>
            </div>
          </>
        )}
      </div>
      <div className="rt--top-bar--right">
        <Button
          size="sm"
          className={cx(
            "rt--top-bar--overlay-btn",
            data.renderer["1"]!.overlay?.type === "black" &&
              "rt--top-bar--selected",
          )}
          onClick={() => {
            if (mainState.renderer["1"]!.overlay?.type === "black") {
              mainState.renderer["1"]!.overlay = null;
            } else {
              mainState.renderer["1"]!.overlay = { type: "black" };
            }
          }}
          data-testid=""
        >
          Black
        </Button>
        {mainState.renderer["1"]!.overlay !== null && (
          <Button
            size="sm"
            onClick={() => {
              mainState.renderer["1"]!.overlay = null;
            }}
          >
            <RxCross1 />
          </Button>
        )}
      </div>
    </div>
  );
};
